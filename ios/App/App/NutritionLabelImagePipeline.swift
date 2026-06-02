import UIKit
import CoreImage
import Vision

/// Prepares curved / bag / bottle label photos for stronger Vision OCR.
enum NutritionLabelImagePipeline {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Returns CGImages to OCR (original + enhanced variants), best first.
    static func ocrCandidates(from image: UIImage) -> [CGImage] {
        guard let base = image.cgImage ?? renderCGImage(from: image) else { return [] }
        var out: [CGImage] = []
        var seen = Set<Int>()

        func append(_ cg: CGImage?) {
            guard let cg = cg else { return }
            let key = cg.width ^ (cg.height << 16)
            if seen.insert(key).inserted { out.append(cg) }
        }

        append(base)
        if let cropped = cropToLargestRectangle(in: base) { append(cropped) }
        if let panel = cropToGuideAspect(from: base) { append(panel) }

        let ci = CIImage(cgImage: base)
        append(render(ci.applyHighContrast()))
        append(render(ci.applySharpen()))
        append(render(ci.applyHighContrast().applySharpen()))

        if let cropped = cropToLargestRectangle(in: base) {
            let cci = CIImage(cgImage: cropped)
            append(render(cci.applyHighContrast()))
        }

        return out
    }

    private static func renderCGImage(from image: UIImage) -> CGImage? {
        UIGraphicsBeginImageContextWithOptions(image.size, true, 1)
        image.draw(in: CGRect(origin: .zero, size: image.size))
        let result = UIGraphicsGetImageFromCurrentImageContext()?.cgImage
        UIGraphicsEndImageContext()
        return result
    }

    private static func render(_ ci: CIImage?) -> CGImage? {
        guard let ci = ci else { return nil }
        return ciContext.createCGImage(ci, from: ci.extent)
    }

    private static func cropToGuideAspect(from cg: CGImage) -> CGImage? {
        let w = CGFloat(cg.width)
        let h = CGFloat(cg.height)
        let targetAspect: CGFloat = 3 / 4
        var cropW = w * 0.88
        var cropH = cropW / targetAspect
        if cropH > h * 0.92 {
            cropH = h * 0.92
            cropW = cropH * targetAspect
        }
        let x = (w - cropW) / 2
        let y = h * 0.12
        return cg.cropping(to: CGRect(x: x, y: y, width: cropW, height: cropH))
    }

    private static func cropToLargestRectangle(in cg: CGImage) -> CGImage? {
        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.25
        request.maximumAspectRatio = 1.2
        request.minimumSize = 0.2
        request.maximumObservations = 6
        request.minimumConfidence = 0.45

        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        guard (try? handler.perform([request])) != nil,
              let rects = request.results as? [VNRectangleObservation],
              !rects.isEmpty else { return nil }

        let best = rects.max { a, b in
            rectArea(a) < rectArea(b)
        }!
        return perspectiveCorrect(cg: cg, observation: best) ?? nil
    }

    private static func rectArea(_ r: VNRectangleObservation) -> CGFloat {
        let w = hypot(r.topRight.x - r.topLeft.x, r.topRight.y - r.topLeft.y)
        let h = hypot(r.bottomLeft.x - r.topLeft.x, r.bottomLeft.y - r.topLeft.y)
        return w * h
    }

    private static func perspectiveCorrect(cg: CGImage, observation: VNRectangleObservation) -> CGImage? {
        let w = CGFloat(cg.width)
        let h = CGFloat(cg.height)
        func pt(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * w, y: (1 - p.y) * h) }
        let tl = pt(observation.topLeft)
        let tr = pt(observation.topRight)
        let bl = pt(observation.bottomLeft)
        let br = pt(observation.bottomRight)

        let ci = CIImage(cgImage: cg)
        let corrected = ci.applyingFilter("CIPerspectiveCorrection", parameters: [
            "inputTopLeft": CIVector(cgPoint: tl),
            "inputTopRight": CIVector(cgPoint: tr),
            "inputBottomLeft": CIVector(cgPoint: bl),
            "inputBottomRight": CIVector(cgPoint: br),
        ])
        return render(corrected)
    }
}

private extension CIImage {
    func applyHighContrast() -> CIImage {
        let controls = applyingFilter("CIColorControls", parameters: [
            kCIInputContrastKey: 1.35,
            kCIInputBrightnessKey: 0.04,
            kCIInputSaturationKey: 0.0,
        ])
        return controls.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 0.35])
    }

    func applySharpen() -> CIImage {
        applyingFilter("CISharpenLuminance", parameters: [kCIInputSharpnessKey: 0.65])
    }
}
