import Foundation
import Capacitor
import UIKit
import AVFoundation

/// Nutrition label OCR + plain photo capture for plated-meal estimates.
@objc(ProyouNutritionLabelPlugin)
public class ProyouNutritionLabelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouNutritionLabelPlugin"
    public let jsName = "ProyouNutritionLabel"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanLabel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickLabelPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickPhoto", returnType: CAPPluginReturnPromise),
    ]

    private var scanCall: CAPPluginCall?
    private var imagePicker: UIImagePickerController?
    private var liveScanner: NutritionLabelScannerViewController?
    /// When true, camera/library returns JPEG only (no Vision OCR) for plated-meal estimates.
    private var skipOcr = false

    @objc func isAvailable(_ call: CAPPluginCall) {
        let camera = UIImagePickerController.isSourceTypeAvailable(.camera)
        call.resolve([
            "available": camera,
            "visionOcr": true,
            "liveScanner": camera,
            "mealPhoto": true,
        ])
    }

    /// Full-screen live scanner with on-screen macro readout; single capture (no multi-page document scan).
    @objc func scanLabel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.skipOcr = false
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera is not available on this device.", "NO_CAMERA")
                return
            }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.presentLiveScanner(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted { self.presentLiveScanner(call) }
                        else {
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
        NutritionLabelOcr.recognizeStrong(from: image) { result in
            DispatchQueue.main.async {
                switch result {
                case .failure(let err):
                    call.reject(err.localizedDescription, "OCR_FAILED")
                case .success(let ocr):
                    self.resolveOcrPayload(ocr: ocr, image: image, call: call)
                }
            }
        }
    }

    @objc func pickLabelPhoto(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.skipOcr = false
            guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
                call.reject("Photo library is not available on this device.", "NO_LIBRARY")
                return
            }
            self.presentImagePicker(sourceType: .photoLibrary, call: call)
        }
    }

    /// Plain camera capture for plated-meal estimates. No OCR.
    @objc func takePhoto(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.skipOcr = true
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera is not available on this device.", "NO_CAMERA")
                return
            }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.presentImagePicker(sourceType: .camera, call: call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.presentImagePicker(sourceType: .camera, call: call)
                        } else {
                            call.reject(
                                "Allow camera access in Settings → PROYOU → Camera to photograph meals.",
                                "PERMISSION_DENIED"
                            )
                        }
                    }
                }
            default:
                call.reject(
                    "Allow camera access in Settings → PROYOU → Camera to photograph meals.",
                    "PERMISSION_DENIED"
                )
            }
        }
    }

    /// Photo library picker for plated-meal estimates. No OCR.
    @objc func pickPhoto(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.skipOcr = true
            guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
                call.reject("Photo library is not available on this device.", "NO_LIBRARY")
                return
            }
            self.presentImagePicker(sourceType: .photoLibrary, call: call)
        }
    }

    private func presentLiveScanner(_ call: CAPPluginCall) {
        scanCall = call
        let scanner = NutritionLabelScannerViewController()
        scanner.modalPresentationStyle = .fullScreen
        scanner.onComplete = { [weak self] payload in
            guard let self = self, let call = self.scanCall else { return }
            call.resolve(payload)
            self.cleanup()
        }
        scanner.onCancel = { [weak self] in
            self?.scanCall?.reject("Cancelled", "CANCELLED")
            self?.cleanup()
        }
        liveScanner = scanner
        bridge?.viewController?.present(scanner, animated: true)
    }

    private func presentImagePicker(sourceType: UIImagePickerController.SourceType, call: CAPPluginCall) {
        scanCall = call
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = self
        picker.allowsEditing = false
        imagePicker = picker
        bridge?.viewController?.present(picker, animated: true)
    }

    private func cleanup() {
        scanCall = nil
        imagePicker = nil
        liveScanner = nil
        skipOcr = false
    }

    private func resolvePhotoOnly(image: UIImage, call: CAPPluginCall) {
        guard let jpeg = image.jpegData(compressionQuality: 0.82) else {
            call.reject("Could not encode photo.", "ENCODE_FAILED")
            cleanup()
            return
        }
        call.resolve([
            "imageBase64": "data:image/jpeg;base64," + jpeg.base64EncodedString(),
            "text": "",
            "lines": [],
        ])
        cleanup()
    }

    private func resolveOcrPayload(ocr: (lines: [String], fullText: String), image: UIImage, call: CAPPluginCall) {
        var payload: [String: Any] = [
            "text": ocr.fullText,
            "lines": ocr.lines,
        ]
        if let jpeg = image.jpegData(compressionQuality: 0.82) {
            payload["imageBase64"] = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        }
        let macros = NutritionLabelMacroParser.parse(text: ocr.fullText)
        if macros.foundCount >= 2 {
            payload["macros"] = [
                "calories": macros.calories ?? 0,
                "protein": macros.protein ?? 0,
                "fat": macros.fat ?? 0,
                "carbs": macros.carbs ?? 0,
            ]
        }
        call.resolve(payload)
        cleanup()
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
        let photoOnly = skipOcr
        picker.dismiss(animated: true) { [weak self] in
            guard let self = self, let image = image else {
                call.reject("No photo captured.", "NO_IMAGE")
                self?.cleanup()
                return
            }
            if photoOnly {
                self.resolvePhotoOnly(image: image, call: call)
                return
            }
            guard let cgImage = image.cgImage else {
                call.reject("No photo captured.", "NO_IMAGE")
                self.cleanup()
                return
            }
            NutritionLabelOcr.recognize(cgImage: cgImage, accurate: true, regionOfInterest: nil) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .failure(let err):
                        call.reject(err.localizedDescription, "OCR_FAILED")
                        self.cleanup()
                    case .success(let ocr):
                        self.resolveOcrPayload(ocr: ocr, image: image, call: call)
                    }
                }
            }
        }
    }
}
