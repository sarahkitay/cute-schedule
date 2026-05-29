import Foundation
import Capacitor
import UIKit
import Vision
import AVFoundation

/// High-accuracy nutrition label OCR using Apple Vision (accurate text recognition).
@objc(ProyouNutritionLabelPlugin)
public class ProyouNutritionLabelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouNutritionLabelPlugin"
    public let jsName = "ProyouNutritionLabel"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanLabel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickLabelPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeImage", returnType: CAPPluginReturnPromise),
    ]

    private var scanCall: CAPPluginCall?
    private var imagePicker: UIImagePickerController?

    @objc func isAvailable(_ call: CAPPluginCall) {
        let camera = UIImagePickerController.isSourceTypeAvailable(.camera)
        call.resolve([
            "available": camera,
            "visionOcr": true,
        ])
    }

  /// Opens camera to capture a nutrition label, then runs Vision OCR.
    @objc func scanLabel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera is not available on this device.", "NO_CAMERA")
                return
            }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.presentCamera(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.presentCamera(call)
                        } else {
                            call.reject(
                                "Allow camera access in Settings → PROYOU → Camera to scan nutrition labels.",
                                "PERMISSION_DENIED"
                            )
                        }
                    }
                }
            default:
                call.reject(
                    "Allow camera access in Settings → PROYOU → Camera to scan nutrition labels.",
                    "PERMISSION_DENIED"
                )
            }
        }
    }

    /// Runs Vision OCR on a base64-encoded JPEG/PNG (e.g. photo library pick on web bridge).
    @objc func recognizeImage(_ call: CAPPluginCall) {
        guard let b64 = call.getString("base64"), !b64.isEmpty else {
            call.reject("Missing base64 image data.", "INVALID_ARGS")
            return
        }
        let raw = b64.contains(",") ? String(b64.split(separator: ",").last ?? "") : b64
        guard let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("Could not decode image.", "INVALID_IMAGE")
            return
        }
        runVisionOcr(on: image, call: call)
    }

    /// Opens the photo library to pick an existing label image, then runs Vision OCR.
    @objc func pickLabelPhoto(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
                call.reject("Photo library is not available on this device.", "NO_LIBRARY")
                return
            }
            self.presentImagePicker(sourceType: .photoLibrary, call: call)
        }
    }

    private func presentCamera(_ call: CAPPluginCall) {
        presentImagePicker(sourceType: .camera, call: call)
    }

    private func presentImagePicker(sourceType: UIImagePickerController.SourceType, call: CAPPluginCall) {
        scanCall = call
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        if sourceType == .camera {
            picker.cameraCaptureMode = .photo
        }
        picker.delegate = self
        picker.allowsEditing = false
        imagePicker = picker
        bridge?.viewController?.present(picker, animated: true)
    }

    private func cleanup() {
        scanCall = nil
        imagePicker = nil
    }

    private func runVisionOcr(on image: UIImage, call: CAPPluginCall) {
        guard let cgImage = image.cgImage else {
            call.reject("Could not process image.", "INVALID_IMAGE")
            return
        }
        let request = VNRecognizeTextRequest { [weak self] req, err in
            if let err = err {
                call.reject("OCR failed: \(err.localizedDescription)", "OCR_FAILED")
                return
            }
            guard let observations = req.results as? [VNRecognizedTextObservation] else {
                call.reject("No text found on the label. Try better lighting and fill the frame with the Nutrition Facts panel.", "NO_TEXT")
                return
            }
            let parsed = Self.assembleOcrLines(from: observations)
            if parsed.lines.isEmpty {
                call.reject("No text found on the label. Center the Nutrition Facts panel and try again.", "NO_TEXT")
                return
            }
            call.resolve([
                "text": parsed.fullText,
                "lines": parsed.lines,
            ])
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.012

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async {
                    call.reject("OCR failed: \(error.localizedDescription)", "OCR_FAILED")
                }
            }
        }
    }

    /// Sort observations top-to-bottom, left-to-right (nutrition panels read vertically).
    private static func assembleOcrLines(from observations: [VNRecognizedTextObservation]) -> (lines: [String], fullText: String) {
        struct Row {
            var y: CGFloat
            var parts: [(x: CGFloat, text: String)]
        }
        var rows: [Row] = []
        let yThreshold: CGFloat = 0.018

        for obs in observations {
            guard let candidate = obs.topCandidates(1).first else { continue }
            let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { continue }
            let box = obs.boundingBox
            let cy = box.midY
            let cx = box.minX
            if let idx = rows.firstIndex(where: { abs($0.y - cy) < yThreshold }) {
                rows[idx].parts.append((cx, text))
                rows[idx].y = (rows[idx].y + cy) / 2
            } else {
                rows.append(Row(y: cy, parts: [(cx, text)]))
            }
        }

        rows.sort { $0.y > $1.y }
        var lines: [String] = []
        for var row in rows {
            row.parts.sort { $0.x < $1.x }
            let line = row.parts.map(\.text).joined(separator: " ")
            lines.append(line)
        }
        let fullText = lines.joined(separator: "\n")
        return (lines, fullText)
    }
}

extension ProyouNutritionLabelPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { [weak self] in
            self?.scanCall?.reject("Cancelled", "CANCELLED")
            self?.cleanup()
        }
    }

    public func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        guard let call = scanCall else {
            picker.dismiss(animated: true)
            return
        }
        let image = (info[.originalImage] as? UIImage)
        picker.dismiss(animated: true) { [weak self] in
            guard let self = self, let image = image else {
                call.reject("No photo captured.", "NO_IMAGE")
                self?.cleanup()
                return
            }
            self.runVisionOcr(on: image, call: call)
            self.cleanup()
        }
    }
}
