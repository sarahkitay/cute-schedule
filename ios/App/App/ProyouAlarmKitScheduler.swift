#if canImport(AlarmKit)
import Foundation
import AlarmKit
import CryptoKit
import SwiftUI

@available(iOS 26.0, *)
enum ProyouAlarmKitScheduler {
    private static let storedIdsKey = "proyou_alarmkit_scheduled_ids_v1"
    private static let kitToProyouKey = "proyou_alarmkit_uuid_map_v1"
    private static let cachedAlarmsKey = "proyou_alarmkit_cached_alarms_v1"
    private static let manager = AlarmManager.shared

    static func isSupported() -> Bool {
        if #available(iOS 26.0, *) { return true }
        return false
    }

    static func authorizationState() -> String {
        switch manager.authorizationState {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    static func requestAuthorization() async throws -> String {
        let state = try await manager.requestAuthorization()
        switch state {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    static func resync(alarms: [[String: Any]]) async throws -> [String: Any] {
        try await ensureAuthorized()

        var scheduled = 0
        let previous = UserDefaults.standard.stringArray(forKey: storedIdsKey) ?? []
        for id in previous {
            if let uuid = UUID(uuidString: id) {
                try? await manager.cancel(id: uuid)
            }
        }

        var newIds: [String] = []
        var uuidMap: [String: String] = [:]
        if let data = try? JSONSerialization.data(withJSONObject: alarms) {
            UserDefaults.standard.set(data, forKey: cachedAlarmsKey)
        }
        for raw in alarms {
            guard (raw["enabled"] as? Bool) != false else { continue }
            guard let alarmId = raw["id"] as? String, !alarmId.isEmpty else { continue }
            guard let time = raw["time"] as? String else { continue }
            let parts = time.split(separator: ":")
            guard parts.count >= 2,
                  let hour = Int(parts[0]),
                  let minute = Int(parts[1]) else { continue }

            let label = (raw["label"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let title = label?.isEmpty == false ? label! : "Morning alarm"
            var days = (raw["days"] as? [Int]) ?? [0, 1, 2, 3, 4, 5, 6]
            if days.isEmpty { days = [0, 1, 2, 3, 4, 5, 6] }
            let mode = raw["mode"] as? String ?? "standard"
            let requiresChallenge = mode == "math_dismiss" || mode == "action_required"
            let soundId = (raw["sound"] as? String) ?? "default"
            let customSoundId = raw["customSoundId"] as? String
            let uuid = stableUUID(alarmId: alarmId)

            let schedule = buildSchedule(hour: hour, minute: minute, jsDays: days)
            let presentation = buildPresentation(title: title, requiresChallenge: requiresChallenge)
            let metadata = ProyouAlarmMetadata(proyouAlarmId: alarmId)
            let attributes = AlarmAttributes(
                presentation: presentation,
                metadata: metadata,
                tintColor: Color(red: 0.35, green: 0.78, blue: 0.62)
            )

            let installedSoundName = ProyouAlarmKitSoundInstaller.resolveSoundName(
                soundId: soundId,
                customSoundId: customSoundId
            )
            let openIntent = ProyouOpenAppAlarmIntent(proyouAlarmId: alarmId)

            if requiresChallenge {
                // Single "Open PROYOU" button (see presentation); both intents open the app without cancelling.
                let configuration = AlarmManager.AlarmConfiguration<ProyouAlarmMetadata>.alarm(
                    schedule: schedule,
                    attributes: attributes,
                    stopIntent: openIntent,
                    secondaryIntent: openIntent,
                    sound: .named(installedSoundName)
                )
                _ = try await manager.schedule(id: uuid, configuration: configuration)
            } else {
                let configuration = AlarmManager.AlarmConfiguration<ProyouAlarmMetadata>.alarm(
                    schedule: schedule,
                    attributes: attributes,
                    stopIntent: ProyouStopAlarmIntent(alarmKitId: uuid.uuidString),
                    secondaryIntent: openIntent,
                    sound: .named(installedSoundName)
                )
                _ = try await manager.schedule(id: uuid, configuration: configuration)
            }
            newIds.append(uuid.uuidString)
            uuidMap[uuid.uuidString] = alarmId
            scheduled += 1
        }

        UserDefaults.standard.set(newIds, forKey: storedIdsKey)
        UserDefaults.standard.set(uuidMap, forKey: kitToProyouKey)
        return ["scheduled": scheduled, "authorization": authorizationState()]
    }

    static func proyouAlarmId(forKitUUID kitId: String) -> String? {
        let map = UserDefaults.standard.dictionary(forKey: kitToProyouKey) as? [String: String]
        return map?[kitId]
    }

    static func resyncFromCachedAlarms() async throws {
        guard let data = UserDefaults.standard.data(forKey: cachedAlarmsKey),
              let alarms = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return }
        _ = try await resync(alarms: alarms)
    }

    static func cancelAlarm(alarmId: String) async throws {
        let uuid = stableUUID(alarmId: alarmId)
        try await manager.cancel(id: uuid)
        var ids = UserDefaults.standard.stringArray(forKey: storedIdsKey) ?? []
        ids.removeAll { $0 == uuid.uuidString }
        UserDefaults.standard.set(ids, forKey: storedIdsKey)
    }

    private static func ensureAuthorized() async throws {
        switch manager.authorizationState {
        case .authorized:
            return
        case .notDetermined:
            let state = try await manager.requestAuthorization()
            if state != .authorized {
                throw NSError(
                    domain: "ProyouAlarmKit",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Alarm permission was not granted. Enable alarms for PROYOU in Settings."]
                )
            }
        case .denied:
            throw NSError(
                domain: "ProyouAlarmKit",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Alarm permission denied. Enable alarms for PROYOU in Settings → Notifications."]
            )
        @unknown default:
            break
        }
    }

    private static func buildSchedule(hour: Int, minute: Int, jsDays: [Int]) -> Alarm.Schedule {
        let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
        let weekdays = jsWeekdays(jsDays)
        let relative = Alarm.Schedule.Relative(
            time: time,
            repeats: weekdays.isEmpty ? .never : .weekly(weekdays)
        )
        return .relative(relative)
    }

    private static func jsWeekdays(_ jsDays: [Int]) -> [Locale.Weekday] {
        let map: [Int: Locale.Weekday] = [
            0: .sunday, 1: .monday, 2: .tuesday, 3: .wednesday,
            4: .thursday, 5: .friday, 6: .saturday,
        ]
        var out: [Locale.Weekday] = []
        for d in jsDays {
            if let w = map[d], !out.contains(w) { out.append(w) }
        }
        return out
    }

    private static func buildPresentation(title: String, requiresChallenge: Bool) -> AlarmPresentation {
        if requiresChallenge {
            let open = AlarmButton(
                text: "Open PROYOU",
                textColor: .white,
                systemImageName: "arrow.up.forward.app"
            )
            let alert = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: title),
                stopButton: open,
                secondaryButton: nil,
                secondaryButtonBehavior: .custom
            )
            return AlarmPresentation(alert: alert)
        }

        let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle.fill")
        let open = AlarmButton(text: "Open PROYOU", textColor: .white, systemImageName: "arrow.up.forward.app")
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: stop,
            secondaryButton: open,
            secondaryButtonBehavior: .custom
        )
        return AlarmPresentation(alert: alert)
    }

    private static func stableUUID(alarmId: String) -> UUID {
        let digest = SHA256.hash(data: Data("proyou.schedule.alarm.\(alarmId)".utf8))
        var bytes = Array(digest.prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x50
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
            bytes[12], bytes[13], bytes[14], bytes[15]
        ))
    }
}
#endif
