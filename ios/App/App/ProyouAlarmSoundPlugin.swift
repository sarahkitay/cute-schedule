import Foundation
import Capacitor
import AVFoundation
import AudioToolbox
import Darwin

/// Loops alarm audio using AVAudioSession. Built-in presets use distinct tone patterns (not one system beep).
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
    private var toneEngine: AVAudioEngine?
    private var tonePlayer: AVAudioPlayerNode?
    private var builtinVariant = 0

    @objc func startRinging(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.stopRingingInternal()
            guard self.activatePlaybackSession() else {
                call.reject("Could not activate audio for alarm playback.")
                return
            }
            let soundId = call.getString("sound") ?? "default"
            if self.startBundledIfPresent(soundId: soundId) {
                call.resolve()
                return
            }
            if self.startCustomFileIfPresent(call) {
                call.resolve()
                return
            }
            self.startBuiltinLoop(soundId: soundId)
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
            let soundId = call.getString("sound") ?? "default"
            if self.startBundledIfPresent(soundId: soundId) {
                self.previewTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { [weak self] _ in
                    self?.stopRingingInternal()
                }
                call.resolve()
                return
            }
            self.builtinVariant = 0
            self.playBuiltinBurst(soundId: soundId)
            self.previewTimer = Timer.scheduledTimer(withTimeInterval: 3.2, repeats: false) { [weak self] _ in
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
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            return true
        } catch {
            return false
        }
    }

    private func startBundledIfPresent(soundId: String) -> Bool {
        guard let url = ProyouAlarmKitSoundInstaller.bundledResourceURL(for: soundId) else { return false }
        return playCustomUrl(url)
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

    private func startBuiltinLoop(soundId: String) {
        builtinVariant = 0
        playBuiltinBurst(soundId: soundId)
        let interval: TimeInterval = ProyouAlarmToneFactory.loopInterval(soundId: soundId)
        ringTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.builtinVariant = (self.builtinVariant + 1) % 3
            self.playBuiltinBurst(soundId: soundId)
            AudioServicesPlayAlertSound(kSystemSoundID_Vibrate)
        }
        if let ringTimer = ringTimer {
            RunLoop.main.add(ringTimer, forMode: .common)
        }
    }

    private func playBuiltinBurst(soundId: String) {
        guard let buffer = ProyouAlarmToneFactory.makeBurstBuffer(soundId: soundId, variant: builtinVariant) else {
            AudioServicesPlaySystemSound(1304)
            return
        }
        if toneEngine == nil {
            toneEngine = AVAudioEngine()
            tonePlayer = AVAudioPlayerNode()
        }
        guard let engine = toneEngine, let player = tonePlayer else { return }
        if !engine.attachedNodes.contains(player) {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
        }
        if !engine.isRunning {
            try? engine.start()
        }
        player.stop()
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        player.play()
    }

    private func stopRingingInternal() {
        previewTimer?.invalidate()
        previewTimer = nil
        ringTimer?.invalidate()
        ringTimer = nil
        tonePlayer?.stop()
        toneEngine?.stop()
        toneEngine = nil
        tonePlayer = nil
        audioPlayer?.stop()
        audioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// Generates short PCM bursts for each built-in alarm sound id (rotating variants).
enum ProyouAlarmToneFactory {
    static func loopInterval(soundId: String) -> TimeInterval {
        let buf = makeBurstBuffer(soundId: soundId, variant: 0)
        let frames = Double(buf?.frameLength ?? 88200)
        let rate = buf?.format.sampleRate ?? 44100
        return max(2.0, frames / rate + 0.55)
    }

    static func makeBurstBuffer(soundId: String, variant: Int = 0) -> AVAudioPCMBuffer? {
        let v = ((variant % 3) + 3) % 3
        switch soundId {
        case "sparkle":
            let seqs: [[(Double, Double)]] = [
                [(1568, 0.2), (2093, 0.22), (2637, 0.18), (3136, 0.25), (3520, 0.28)],
                [(1760, 0.18), (2217, 0.2), (2794, 0.22), (3322, 0.25)],
                [(2093, 0.15), (2637, 0.18), (3136, 0.2), (3729, 0.22)],
            ]
            return makeSequence(seqs[v], wave: .sine, vol: 0.3)
        case "musicbox":
            let seqs: [[(Double, Double)]] = [
                [(523, 0.55), (659, 0.5), (784, 0.55), (1047, 0.65)],
                [(440, 0.5), (554, 0.48), (659, 0.52), (880, 0.6)],
                [(392, 0.48), (494, 0.45), (587, 0.5), (740, 0.58)],
            ]
            return makeSequence(seqs[v], wave: .triangle, vol: 0.36)
        case "chime":
            let seqs: [[(Double, Double)]] = [
                [(1318, 0.55), (1568, 0.5), (1760, 0.65), (2093, 0.7)],
                [(1047, 0.45), (1175, 0.5), (1319, 0.55), (1568, 0.75)],
                [(988, 0.4), (1245, 0.45), (1480, 0.5), (1976, 0.8)],
            ]
            return makeSequence(seqs[v], wave: .sine, vol: 0.32)
        case "bells":
            let seqs: [[(Double, Double)]] = [
                [(523, 0.35), (659, 0.32), (784, 0.3), (1047, 0.4), (1319, 0.45)],
                [(440, 0.3), (554, 0.28), (659, 0.32), (880, 0.38)],
                [(587, 0.28), (740, 0.35), (988, 0.42), (1175, 0.5)],
            ]
            return makeSequence(seqs[v], wave: .triangle, vol: 0.38)
        case "digital":
            return makeBeeps(count: v == 0 ? 10 : 8, freq: 990 + Double(v) * 80, spacing: 0.12, len: 0.1, vol: 0.38)
        case "birds":
            let seqs: [[(Double, Double)]] = [
                [(2400, 0.08), (2800, 0.07), (2200, 0.09), (3100, 0.08), (2600, 0.1)],
                [(2100, 0.1), (2650, 0.09), (3200, 0.08), (2450, 0.1)],
                [(2750, 0.07), (2300, 0.09), (3000, 0.08), (2850, 0.09)],
            ]
            return makeSequence(seqs[v], wave: .sine, vol: 0.2)
        case "piano":
            let seqs: [[(Double, Double)]] = [
                [(262, 0.42), (330, 0.38), (392, 0.4), (523, 0.48), (659, 0.55)],
                [(294, 0.35), (370, 0.36), (440, 0.38), (587, 0.45)],
                [(349, 0.4), (440, 0.38), (523, 0.42), (698, 0.52)],
            ]
            return makeSequence(seqs[v], wave: .triangle, vol: 0.36)
        case "default":
            fallthrough
        default:
            let seqs: [[(Double, Double)]] = [
                [(784, 0.14), (988, 0.14), (784, 0.14), (988, 0.14), (784, 0.14), (988, 0.16)],
                [(660, 0.12), (880, 0.12), (660, 0.12), (880, 0.12), (660, 0.12), (880, 0.14)],
                [(880, 0.11), (1109, 0.11), (880, 0.11), (1109, 0.11), (880, 0.11), (1109, 0.13)],
            ]
            return makeSequence(seqs[v], wave: .square, vol: 0.42)
        }
    }

    private enum Wave { case sine, triangle, square }

    private static func makeBeeps(count: Int, freq: Double, spacing: Double, len: Double, vol: Float) -> AVAudioPCMBuffer? {
        var notes: [(Double, Double)] = []
        for _ in 0..<count { notes.append((freq, len)) }
        return makeSequence(notes, wave: .square, vol: vol, gap: spacing - len)
    }

    private static func makeSequence(
        _ notes: [(Double, Double)],
        wave: Wave,
        vol: Float,
        gap: Double = 0.08
    ) -> AVAudioPCMBuffer? {
        let sampleRate = 44100.0
        let totalDur = notes.reduce(0.0) { $0 + $1.1 } + gap * Double(max(0, notes.count - 1))
        let frameCount = AVAudioFrameCount(totalDur * sampleRate)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount
        guard let channel = buffer.floatChannelData?[0] else { return nil }

        var offset = 0
        for (idx, note) in notes.enumerated() {
            let frames = Int(note.1 * sampleRate)
            for i in 0..<frames {
                let t = Double(i) / sampleRate
                let env = min(1.0, min(t / 0.015, (note.1 - t) / 0.04))
                let sample: Float
                switch wave {
                case .sine: sample = Float(sin(2 * .pi * note.0 * t) * env) * vol
                case .triangle:
                    let phase = note.0 * t
                    sample = Float(4 * abs(phase - floor(phase + 0.5)) - 1) * Float(env) * vol
                case .square:
                    sample = Float(sin(2 * .pi * note.0 * t) >= 0 ? 1 : -1) * Float(env) * vol * 0.7
                }
                if offset + i < Int(frameCount) { channel[offset + i] = sample }
            }
            offset += frames
            if idx < notes.count - 1 {
                offset += Int(gap * sampleRate)
            }
        }
        return buffer
    }
}
