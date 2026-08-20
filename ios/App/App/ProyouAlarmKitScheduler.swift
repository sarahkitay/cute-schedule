#if canImport(AlarmKit)
import Foundation
import ActivityKit
import AlarmKit
import CryptoKit
import SwiftUI

@available(iOS 26.0, *)
enum ProyouAlarmKitScheduler {
    private static let storedIdsKey = "proyou_alarmkit_scheduled_ids_v1"
    private static let kitToProyouKey = "proyou_alarmkit_uuid_map_v1"
    private static let cachedAlarmsKey = "proyou_alarmkit_cached_alarms_v1"
    private static let manager = AlarmManager.shared

    static func isSupported() -> Bool { true }

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
                try? manager.cancel(id: uuid)
            }
        }

        var newIds: [String] = []
        var uuidMap: [String: String] = [:]
        if let data = try? JSONSerialization.data(withJSONObject: alarms) {
            UserDefaults.standard.set(data, forKey: cachedAlarmsKey)
        }
        for raw in alarms {
            let enabledFlag = Self.boolValue(raw["enabled"])
            if enabledFlag == false { continue }
            let alarmId = Self.stringValue(raw["id"])
            guard !alarmId.isEmpty else { continue }
            let time = Self.stringValue(raw["time"])
            guard !time.isEmpty else { continue }
            let parts = time.split(separator: ":")
            guard parts.count >= 2,
                  let hour = Int(parts[0]),
                  let minute = Int(parts[1]) else { continue }

            let label = Self.stringValue(raw["label"]).trimmingCharacters(in: .whitespacesAndNewlines)
            let title = label.isEmpty ? "Morning alarm" : label
            var days = Self.intArray(raw["days"])
            if days.isEmpty { days = [0, 1, 2, 3, 4, 5, 6] }
            let mode = Self.stringValue(raw["mode"], fallback: "standard")
            let requiresChallenge = mode == "math_dismiss" || mode == "action_required" || mode == "riddle" || mode == "puzzle"
            let soundId = Self.stringValue(raw["sound"], fallback: "default")
            let uuid = stableUUID(alarmId: alarmId)

            let schedule = buildSchedule(hour: hour, minute: minute, jsDays: days)
            let presentation = buildPresentation(title: title, requiresChallenge: requiresChallenge, mode: mode)
            let metadata = ProyouAlarmMetadata(
                proyouAlarmId: alarmId,
                alarmLabel: title,
                wakeMode: mode,
                alarmKitUUID: uuid.uuidString
            )
            let attributes = AlarmAttributes(
                presentation: presentation,
                metadata: metadata,
                tintColor: Color(red: 0.909, green: 0.663, blue: 0.718)
            )

            let installedSoundName = ProyouAlarmKitSoundInstaller.installSound(soundId: soundId)
            let soundReady = ProyouAlarmKitSoundInstaller.soundFileExists(named: installedSoundName)
            // AlarmKit uses ActivityKit AlertSound (not Alarm.Sound) for lock-screen audio.
            let alarmSound: AlertConfiguration.AlertSound = soundReady
                ? .named(installedSoundName)
                : .default
            let openIntent = ProyouOpenAppAlarmIntent(proyouAlarmId: alarmId)

            if requiresChallenge {
                let initIntent = ProyouWakeInitChallengeIntent(
                    alarmKitId: uuid.uuidString,
                    proyouAlarmId: alarmId,
                    wakeMode: mode
                )
                let configuration = AlarmManager.AlarmConfiguration<ProyouAlarmMetadata>.alarm(
                    schedule: schedule,
                    attributes: attributes,
                    stopIntent: initIntent,
                    secondaryIntent: openIntent,
                    sound: alarmSound
                )
                _ = try await manager.schedule(id: uuid, configuration: configuration)
            } else {
                let configuration = AlarmManager.AlarmConfiguration<ProyouAlarmMetadata>.alarm(
                    schedule: schedule,
                    attributes: attributes,
                    stopIntent: ProyouStopAlarmIntent(alarmKitId: uuid.uuidString),
                    secondaryIntent: openIntent,
                    sound: alarmSound
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
        try manager.cancel(id: uuid)
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

    private static func buildPresentation(title: String, requiresChallenge: Bool, mode: String) -> AlarmPresentation {
        if requiresChallenge {
            let open = AlarmButton(
                text: "Open app",
                textColor: .white,
                systemImageName: "arrow.up.forward.app"
            )
            let play = AlarmButton(
                text: "Play on lock screen",
                textColor: .white,
                systemImageName: "lock.open"
            )
            let challengeTitle: String
            switch mode {
            case "puzzle":
                challengeTitle = "\(title) · Slide puzzle"
            case "math_dismiss":
                challengeTitle = "\(title) · Math wake-up"
            case "action_required":
                challengeTitle = "\(title) · Typing challenge"
            case "riddle":
                challengeTitle = "\(title) · Morning riddle"
            default:
                challengeTitle = title
            }
            let alert = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: challengeTitle),
                stopButton: play,
                secondaryButton: open,
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

    // MARK: - JS payload coercion (Capacitor often sends NSNumber / mixed types)

    private static func stringValue(_ raw: Any?, fallback: String = "") -> String {
        if let s = raw as? String { return s }
        if let n = raw as? NSNumber { return n.stringValue }
        if let i = raw as? Int { return String(i) }
        return fallback
    }

    private static func boolValue(_ raw: Any?) -> Bool? {
        if let b = raw as? Bool { return b }
        if let n = raw as? NSNumber { return n.boolValue }
        if let s = raw as? String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["true", "1", "yes"].contains(t) { return true }
            if ["false", "0", "no"].contains(t) { return false }
        }
        return nil
    }

    private static func intArray(_ raw: Any?) -> [Int] {
        guard let arr = raw as? [Any] else {
            if let ints = raw as? [Int] { return ints }
            return []
        }
        return arr.compactMap { item in
            if let i = item as? Int { return i }
            if let n = item as? NSNumber { return n.intValue }
            if let s = item as? String, let i = Int(s) { return i }
            return nil
        }
    }

    // MARK: - Focus timer (Clock-style countdown + alert)

    private static func focusTimerUUID() -> UUID {
        let digest = SHA256.hash(data: Data("proyou.focus.timer.active".utf8))
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

    static func scheduleFocusTimer(label: String, durationSeconds: Double, sessionId: String) async throws -> [String: Any] {
        try await ensureAuthorized()

        let uuid = focusTimerUUID()
        try? manager.cancel(id: uuid)

        let title = label.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayTitle = title.isEmpty ? "Focus timer" : title
        let duration = max(1.0, durationSeconds)

        let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle.fill")
        let open = AlarmButton(text: "Open PROYOU", textColor: .white, systemImageName: "arrow.up.forward.app")
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: displayTitle),
            stopButton: stop,
            secondaryButton: open,
            secondaryButtonBehavior: .custom
        )
        let countdown = AlarmPresentation.Countdown(
            title: LocalizedStringResource(stringLiteral: displayTitle),
            pauseButton: nil
        )
        let paused = AlarmPresentation.Paused(
            title: LocalizedStringResource(stringLiteral: "Paused"),
            resumeButton: AlarmButton(
                text: "Resume",
                textColor: .white,
                systemImageName: "play.fill"
            )
        )
        let presentation = AlarmPresentation(
            alert: alert,
            countdown: countdown,
            paused: paused
        )
        let metadata = ProyouFocusTimerMetadata(sessionId: sessionId, label: displayTitle)
        let attributes = AlarmAttributes(
            presentation: presentation,
            metadata: metadata,
            tintColor: Color(red: 0.85, green: 0.45, blue: 0.55)
        )
        let stopIntent = ProyouStopFocusTimerIntent(sessionId: sessionId)
        let openIntent = ProyouOpenAppFocusTimerIntent(sessionId: sessionId)

        let configuration = AlarmManager.AlarmConfiguration<ProyouFocusTimerMetadata>.timer(
            duration: duration,
            attributes: attributes,
            stopIntent: stopIntent,
            secondaryIntent: openIntent,
            sound: AlertConfiguration.AlertSound.default
        )
        let alarm = try await manager.schedule(id: uuid, configuration: configuration)
        return [
            "scheduled": 1,
            "durationSec": duration,
            "sessionId": sessionId,
            "state": String(describing: alarm.state),
        ]
    }

    static func cancelFocusTimer() async throws {
        let uuid = focusTimerUUID()
        try? manager.stop(id: uuid)
        try manager.cancel(id: uuid)
    }
}
#endif
