import Foundation
import Capacitor
import MediaPlayer

/// Presents the system music library picker and copies a locally available track for alarm playback.
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
                    picker.showsCloudItems = true
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
            guard let assetURL = item.assetURL else {
                call.reject(
                    "This track isn’t on your device yet. In the Music app, tap ⋯ on the song and choose Download, then try again. Or use Choose from Files for an MP3/M4A you own.",
                    "NO_LOCAL_FILE"
                )
                self.cleanupPicker()
                return
            }
            let ext = assetURL.pathExtension.isEmpty ? "m4a" : assetURL.pathExtension
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("proyou_alarm_\(UUID().uuidString).\(ext)")
            do {
                if FileManager.default.fileExists(atPath: dest.path) {
                    try FileManager.default.removeItem(at: dest)
                }
                try FileManager.default.copyItem(at: assetURL, to: dest)
                call.resolve([
                    "path": dest.path,
                    "title": title,
                    "mimeType": self.mimeType(for: ext),
                ])
            } catch {
                call.reject("Could not prepare that song: \(error.localizedDescription)", "EXPORT_FAILED")
            }
            self.cleanupPicker()
        }
    }

    public func mediaPickerDidCancel(_ mediaPicker: MPMediaPickerController) {
        mediaPicker.dismiss(animated: true) { [weak self] in
            self?.pickerCall?.reject("Cancelled", "CANCELLED")
            self?.cleanupPicker()
        }
    }
}
