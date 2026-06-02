import Foundation
import Capacitor
import MediaPlayer
import AVFoundation

/// Presents the music library picker and exports a playable local audio file for alarms.
@objc(ProyouMusicPickerPlugin)
public class ProyouMusicPickerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouMusicPickerPlugin"
    public let jsName = "ProyouMusicPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickSong", returnType: CAPPluginReturnPromise),
    ]

    private var pickerCall: CAPPluginCall?
    private var mediaPicker: MPMediaPickerController?

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        call.resolve(["available": false, "reason": "simulator"])
        #else
        call.resolve(["available": true])
        #endif
    }

    @objc func pickSong(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.pickerCall = call
            MPMediaLibrary.requestAuthorization { status in
                DispatchQueue.main.async {
                    guard status == .authorized else {
                        call.reject(
                            "Allow access to your music library in Settings → PROYOU → Media & Apple Music.",
                            "PERMISSION_DENIED"
                        )
                        self.cleanupPicker()
                        return
                    }
                    let picker = MPMediaPickerController(mediaTypes: .music)
                    picker.delegate = self
                    picker.allowsPickingMultipleItems = false
                    picker.showsCloudItems = false
                    if #available(iOS 14.0, *) {
                        picker.showsItemsWithProtectedAssets = false
                    }
                    self.mediaPicker = picker
                    self.bridge?.viewController?.present(picker, animated: true)
                }
            }
        }
    }

    private func cleanupPicker() {
        pickerCall = nil
        mediaPicker = nil
    }

    private func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "aac": return "audio/aac"
        default: return "audio/mp4"
        }
    }

    private func exportItem(_ item: MPMediaItem, to dest: URL, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let assetURL = item.assetURL else {
            completion(.failure(ExportError.noLocalFile(item: item)))
            return
        }
        let asset = AVURLAsset(url: assetURL)
        if asset.isExportable {
            guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
                copyFile(from: assetURL, to: dest, completion: completion)
                return
            }
            session.outputURL = dest
            session.outputFileType = .m4a
            session.exportAsynchronously {
                switch session.status {
                case .completed:
                    completion(.success(()))
                case .failed, .cancelled:
                    self.copyFile(from: assetURL, to: dest, completion: completion)
                default:
                    self.copyFile(from: assetURL, to: dest, completion: completion)
                }
            }
            return
        }
        copyFile(from: assetURL, to: dest, completion: completion)
    }

    private func copyFile(from source: URL, to dest: URL, completion: @escaping (Result<Void, Error>) -> Void) {
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: source, to: dest)
            completion(.success(()))
        } catch {
            completion(.failure(error))
        }
    }

    private enum ExportError: LocalizedError {
        case noLocalFile(item: MPMediaItem)

        var errorDescription: String? {
            switch self {
            case .noLocalFile(let item):
                let title = item.title ?? "This song"
                if item.isCloudItem {
                    return "\(title) is only in the cloud. Download it in the Music app (⋯ → Download), then try again. Or use Choose from Files for an MP3/M4A you own."
                }
                if item.hasProtectedAsset {
                    return "\(title) is an Apple Music download and can't be copied into PROYOU (DRM). Use Choose from Files for an MP3/M4A, or sync music from Finder/iTunes."
                }
                return "\(title) isn't available as a file on this iPhone. Use Choose from Files for an MP3/M4A, or sync the track from Finder/iTunes."
            }
        }
    }
}

extension ProyouMusicPickerPlugin: MPMediaPickerControllerDelegate {
    public func mediaPicker(
        _ mediaPicker: MPMediaPickerController,
        didPickMediaItems mediaItemCollection: MPMediaItemCollection
    ) {
        mediaPicker.dismiss(animated: true) { [weak self] in
            guard let self = self, let call = self.pickerCall else { return }
            guard let item = mediaItemCollection.items.first else {
                call.reject("No song selected", "CANCELLED")
                self.cleanupPicker()
                return
            }
            let title = item.title ?? "Song"
            let ext = "m4a"
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("proyou_alarm_\(UUID().uuidString).\(ext)")

            self.exportItem(item, to: dest) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success:
                        call.resolve([
                            "path": dest.path,
                            "title": title,
                            "mimeType": self.mimeType(for: ext),
                        ])
                    case .failure(let err):
                        call.reject(err.localizedDescription, "NO_LOCAL_FILE")
                    }
                    self.cleanupPicker()
                }
            }
        }
    }

    public func mediaPickerDidCancel(_ mediaPicker: MPMediaPickerController) {
        mediaPicker.dismiss(animated: true) { [weak self] in
            self?.pickerCall?.reject("Cancelled", "CANCELLED")
            self?.cleanupPicker()
        }
    }
}
