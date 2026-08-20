import Foundation
import AVFoundation

/// Writes alarm audio into Library/Sounds so AlarmKit `AlertConfiguration.AlertSound.named()` can play it.
enum ProyouAlarmKitSoundInstaller {
    private static let maxAlarmSeconds: TimeInterval = 30

    static func resolveSoundName(soundId: String, customSoundId: String?) -> String {
        if soundId == "custom", let cid = customSoundId, !cid.isEmpty {
            return installCustomSound(customSoundId: cid)
        }
        return installSound(soundId: soundId)
    }

    static func installSound(soundId: String) -> String {
        let mapped = mapSoundId(soundId)
        let baseName = "proyou_\(mapped)"
        if let source = bundledResourceURL(for: mapped) {
            let dest = librarySoundsDirectory().appendingPathComponent("\(baseName).caf")
            if convertToAlarmCAF(source: source, dest: dest) {
                return baseName
            }
        }
        guard let loop = makeLoopBuffer(soundId: mapped, repeatCount: 14) else {
            return baseName
        }
        let dest = librarySoundsDirectory().appendingPathComponent("\(baseName).caf")
        writeBuffer(loop, to: dest)
        return baseName
    }

    /// True when Library/Sounds has a usable CAF for AlarmKit `.named(...)`.
    static func soundFileExists(named baseName: String) -> Bool {
        let dest = librarySoundsDirectory().appendingPathComponent("\(baseName).caf")
        return FileManager.default.fileExists(atPath: dest.path)
    }

    /// Bundled mp3 shipped in the Capacitor `public/sounds` folder.
    private static let bundledMp3BaseNames: [String: String] = [
        "edgy_ringtone": "proyou-edgy-ringtone",
        "wake_up_legend": "proyou-wake-up-you-legend",
        "wake_up_legend_2": "proyou-wake-up-you-legend-2",
        "morning_light": "proyou-morning-light-awakens",
        "morning_light_2": "proyou-morning-light-awakens-2",
        "on_the_clock": "proyou-youre-on-the-clock",
    ]

    static func bundledResourceURL(for soundId: String) -> URL? {
        guard let base = bundledMp3BaseNames[soundId] else { return nil }
        return Bundle.main.url(
            forResource: base,
            withExtension: "mp3",
            subdirectory: "public/sounds"
        ) ?? Bundle.main.url(forResource: base, withExtension: "mp3")
    }

    /// Copies imported audio from disk or app storage into Library/Sounds for AlarmKit.
    @discardableResult
    static func importCustomSource(customSoundId: String, sourcePath: String) -> Bool {
        let url = URL(fileURLWithPath: sourcePath)
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        return persistCustomSource(customSoundId: customSoundId, from: url)
    }

    @discardableResult
    static func saveCustomSource(customSoundId: String, data: Data, fileExtension: String = "m4a") -> Bool {
        let dest = storageFileURL(customSoundId: customSoundId, ext: fileExtension)
        do {
            try ensureStorageDirectory()
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try data.write(to: dest)
            return true
        } catch {
            NSLog("[ProyouAlarmKit] save custom source failed: %@", error.localizedDescription)
            return false
        }
    }

    static func installCustomSound(customSoundId: String) -> String {
        let safe = sanitize(customSoundId)
        let baseName = "proyou_custom_\(safe)"
        guard let source = findStoredCustomURL(customSoundId: customSoundId) else {
            NSLog("[ProyouAlarmKit] no stored custom sound for %@", customSoundId)
            return installSound(soundId: "default")
        }
        let dest = librarySoundsDirectory().appendingPathComponent("\(baseName).caf")
        if convertToAlarmCAF(source: source, dest: dest) {
            return baseName
        }
        return installSound(soundId: "default")
    }

    // MARK: - Private

    private static func persistCustomSource(customSoundId: String, from source: URL) -> Bool {
        let ext = source.pathExtension.isEmpty ? "m4a" : source.pathExtension
        let dest = storageFileURL(customSoundId: customSoundId, ext: ext)
        do {
            try ensureStorageDirectory()
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: source, to: dest)
            return true
        } catch {
            NSLog("[ProyouAlarmKit] persist custom failed: %@", error.localizedDescription)
            return false
        }
    }

    private static func librarySoundsDirectory() -> URL {
        let dir = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Sounds", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func storageDirectory() -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ProyouAlarmSounds", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func ensureStorageDirectory() throws {
        try FileManager.default.createDirectory(at: storageDirectory(), withIntermediateDirectories: true)
    }

    private static func storageFileURL(customSoundId: String, ext: String) -> URL {
        storageDirectory().appendingPathComponent("\(sanitize(customSoundId)).\(ext)")
    }

    private static func findStoredCustomURL(customSoundId: String) -> URL? {
        let base = sanitize(customSoundId)
        let dir = storageDirectory()
        guard let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else {
            return nil
        }
        return files.first { $0.deletingPathExtension().lastPathComponent == base }
    }

    private static func sanitize(_ id: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-"))
        let cleaned = id.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
        let s = String(cleaned)
        return String(s.prefix(48))
    }

    private static func mapSoundId(_ soundId: String) -> String {
        switch soundId {
        case "chime", "bells", "digital", "birds", "piano", "default", "sparkle", "musicbox",
             "edgy_ringtone", "wake_up_legend", "wake_up_legend_2", "morning_light",
             "morning_light_2", "on_the_clock":
            return soundId
        default:
            return "default"
        }
    }

    private static func writeBuffer(_ buffer: AVAudioPCMBuffer, to dest: URL) {
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            if let file = try? AVAudioFile(forWriting: dest, settings: buffer.format.settings) {
                try file.write(from: buffer)
            }
        } catch {
            NSLog("[ProyouAlarmKit] write buffer failed: %@", error.localizedDescription)
        }
    }

    private static func convertToAlarmCAF(source: URL, dest: URL) -> Bool {
        do {
            let asset = AVURLAsset(url: source)
            let duration = min(CMTimeGetSeconds(asset.duration), maxAlarmSeconds)
            guard duration > 0.1 else { return false }

            let file = try AVAudioFile(forReading: source)
            let format = file.processingFormat
            let frameCount = AVAudioFrameCount(duration * format.sampleRate)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
                return false
            }
            try file.read(into: buffer, frameCount: frameCount)
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            let out = try AVAudioFile(forWriting: dest, settings: format.settings)
            try out.write(from: buffer)
            return FileManager.default.fileExists(atPath: dest.path)
        } catch {
            NSLog("[ProyouAlarmKit] CAF convert failed: %@", error.localizedDescription)
            return false
        }
    }

    private static func makeLoopBuffer(soundId: String, repeatCount: Int) -> AVAudioPCMBuffer? {
        guard let burst = ProyouAlarmToneFactory.makeBurstBuffer(soundId: soundId),
              let channel = burst.floatChannelData?[0] else { return nil }
        let sampleRate = burst.format.sampleRate
        let gapFrames = AVAudioFrameCount(sampleRate * 0.35)
        let unit = burst.frameLength + gapFrames
        let totalFrames = unit * AVAudioFrameCount(repeatCount) - gapFrames
        guard let out = AVAudioPCMBuffer(pcmFormat: burst.format, frameCapacity: totalFrames),
              let outChannel = out.floatChannelData?[0] else { return nil }
        out.frameLength = totalFrames

        var writeAt = 0
        for rep in 0..<repeatCount {
            for i in 0..<Int(burst.frameLength) {
                if writeAt + i < Int(totalFrames) {
                    outChannel[writeAt + i] = channel[i]
                }
            }
            writeAt += Int(burst.frameLength)
            if rep < repeatCount - 1 {
                writeAt += Int(gapFrames)
            }
        }
        return out
    }
}
