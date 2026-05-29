import Foundation
import Capacitor
import AVFoundation
import AudioToolbox

/// Loops alarm audio using AVAudioSession (works when app is open or woken from a notification).
@objc(ProyouAlarmSoundPlugin)
public class ProyouAlarmSoundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouAlarmSoundPlugin"
    public let jsName = "ProyouAlarmSound"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRinging", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRinging", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previewSound", returnType: CAPPluginReturnPromise),
    ]

    private var ringTimer: Timer?
    private var previewTimer: Timer?
    private var audioPlayer: AVAudioPlayer?

    @objc func startRinging(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.stopRingingInternal()
            guard self.activatePlaybackSession() else {
                call.reject("Could not activate audio for alarm playback.")
                return
            }
            if self.startCustomFileIfPresent(call) {
                call.resolve()
                return
            }
            self.startSystemAlarmLoop()
            call.resolve()
        }
    }

    @objc func previewSound(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.stopRingingInternal()
            guard self.activatePlaybackSession() else {
                call.reject("Could not activate audio.")
                return
            }
            if self.startCustomFileIfPresent(call) {
                self.previewTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: false) { [weak self] _ in
                    self?.stopRingingInternal()
                }
                call.resolve()
                return
            }
            self.playSystemAlarmBurst()
            self.previewTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: false) { [weak self] _ in
                self?.stopRingingInternal()
            }
            call.resolve()
        }
    }

    @objc func stopRinging(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.stopRingingInternal()
            call.resolve()
        }
    }

    private func activatePlaybackSession() -> Bool {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.duckOthers])
            try session.setActive(true)
            return true
        } catch {
            return false
        }
    }

    private func startCustomFileIfPresent(_ call: CAPPluginCall) -> Bool {
        if let path = call.getString("customPath"), !path.isEmpty,
           FileManager.default.fileExists(atPath: path) {
            return playCustomUrl(URL(fileURLWithPath: path))
        }
        if let b64 = call.getString("customBase64"), !b64.isEmpty {
            let raw = b64.contains(",") ? String(b64.split(separator: ",").last ?? "") : b64
            guard let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters) else { return false }
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("proyou_alarm_\(UUID().uuidString).m4a")
            do {
                try data.write(to: dest)
                return playCustomUrl(dest)
            } catch {
                return false
            }
        }
        return false
    }

    private func playCustomUrl(_ url: URL) -> Bool {
        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.numberOfLoops = -1
            audioPlayer?.volume = 1.0
            audioPlayer?.prepareToPlay()
            audioPlayer?.play()
            return true
        } catch {
            return false
        }
    }

    private func startSystemAlarmLoop() {
        playSystemAlarmBurst()
        ringTimer = Timer.scheduledTimer(withTimeInterval: 1.25, repeats: true) { [weak self] _ in
            self?.playSystemAlarmBurst()
        }
        if let ringTimer = ringTimer {
            RunLoop.main.add(ringTimer, forMode: .common)
        }
    }

    private func playSystemAlarmBurst() {
        AudioServicesPlaySystemSound(1304)
        AudioServicesPlayAlertSound(kSystemSoundID_Vibrate)
    }

    private func stopRingingInternal() {
        previewTimer?.invalidate()
        previewTimer = nil
        ringTimer?.invalidate()
        ringTimer = nil
        audioPlayer?.stop()
        audioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
