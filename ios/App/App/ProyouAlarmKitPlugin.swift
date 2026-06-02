import Foundation
import Capacitor

/// Bridges PROYOU alarms to AlarmKit on iOS 26+ (system morning alarms). Falls back to local notifications on older iOS.
@objc(ProyouAlarmKitPlugin)
public class ProyouAlarmKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouAlarmKitPlugin"
    public let jsName = "ProyouAlarmKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAuthorizationState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resyncAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingAlarmOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingAlarmDismiss", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installCustomSound", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve([
                "available": true,
                "alarmKit": true,
                "authorization": ProyouAlarmKitScheduler.authorizationState(),
            ])
            return
        }
        #endif
        call.resolve(["available": false, "alarmKit": false, "reason": "requires_ios_26"])
    }

    @objc func getAuthorizationState(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["state": ProyouAlarmKitScheduler.authorizationState()])
            return
        }
        #endif
        call.resolve(["state": "unavailable"])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    let state = try await ProyouAlarmKitScheduler.requestAuthorization()
                    call.resolve(["state": state])
                } catch {
                    call.reject(error.localizedDescription, "AUTH_DENIED")
                }
            }
            return
        }
        #endif
        call.reject("AlarmKit requires iOS 26 or later.", "UNAVAILABLE")
    }

    @objc func resyncAlarms(_ call: CAPPluginCall) {
        guard let alarms = call.getArray("alarms") as? [[String: Any]] else {
            call.reject("Missing alarms array.", "INVALID_ARGS")
            return
        }
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    let result = try await ProyouAlarmKitScheduler.resync(alarms: alarms)
                    call.resolve(result)
                } catch {
                    call.reject(error.localizedDescription, "SYNC_FAILED")
                }
            }
            return
        }
        #endif
        call.reject("AlarmKit requires iOS 26 or later.", "UNAVAILABLE")
    }

    @objc func cancelAlarm(_ call: CAPPluginCall) {
        guard let alarmId = call.getString("alarmId"), !alarmId.isEmpty else {
            call.reject("Missing alarmId.", "INVALID_ARGS")
            return
        }
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    try await ProyouAlarmKitScheduler.cancelAlarm(alarmId: alarmId)
                    call.resolve()
                } catch {
                    call.reject(error.localizedDescription, "CANCEL_FAILED")
                }
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func consumePendingAlarmOpen(_ call: CAPPluginCall) {
        let alarmId = ProyouAlarmPendingOpen.consume() ?? ""
        call.resolve(["alarmId": alarmId])
    }

    @objc func consumePendingAlarmDismiss(_ call: CAPPluginCall) {
        let alarmId = ProyouAlarmPendingDismiss.consume() ?? ""
        call.resolve(["alarmId": alarmId])
    }

    /// Saves an imported song for AlarmKit (Library/Sounds). Pass `path` from the music picker or `base64` from web storage.
    @objc func installCustomSound(_ call: CAPPluginCall) {
        guard let customSoundId = call.getString("customSoundId"), !customSoundId.isEmpty else {
            call.reject("Missing customSoundId.", "INVALID_ARGS")
            return
        }
        if let path = call.getString("path"), !path.isEmpty {
            _ = ProyouAlarmKitSoundInstaller.importCustomSource(customSoundId: customSoundId, sourcePath: path)
        } else if let b64 = call.getString("base64"), !b64.isEmpty {
            let raw = b64.contains(",") ? String(b64.split(separator: ",").last ?? "") : b64
            if let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters) {
                let ext = call.getString("fileExtension") ?? "m4a"
                _ = ProyouAlarmKitSoundInstaller.saveCustomSource(
                    customSoundId: customSoundId,
                    data: data,
                    fileExtension: ext
                )
            }
        }
        let soundName = ProyouAlarmKitSoundInstaller.installCustomSound(customSoundId: customSoundId)
        call.resolve(["soundName": soundName])
    }
}
