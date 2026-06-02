import UIKit
import Vision

enum NutritionLabelOcr {
    /// Multi-pass OCR for bottle/bag/curved labels (contrast + perspective crops + merge).
    static func recognizeStrong(
        from image: UIImage,
        completion: @escaping (Result<(lines: [String], fullText: String), Error>) -> Void
    ) {
        let candidates = NutritionLabelImagePipeline.ocrCandidates(from: image)
        guard !candidates.isEmpty else {
            completion(.failure(NSError(domain: "NutritionLabelOcr", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not process image."])))
            return
        }
        var mergedLines: [String] = []
        var seenLine = Set<String>()
        let group = DispatchGroup()
        let lock = NSLock()
        var anySuccess = false
        var lastError: Error?

        for cg in candidates.prefix(6) {
            group.enter()
            recognize(cgImage: cg, accurate: true, regionOfInterest: nil) { result in
                defer { group.leave() }
                switch result {
                case .success(let parsed):
                    lock.lock()
                    anySuccess = true
                    for line in parsed.lines {
                        let key = line.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                        if !key.isEmpty, seenLine.insert(key).inserted {
                            mergedLines.append(line)
                        }
                    }
                    lock.unlock()
                case .failure(let err):
                    lastError = err
                }
            }
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            if mergedLines.isEmpty {
                completion(.failure(lastError ?? NSError(domain: "NutritionLabelOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "No text found on the label."])))
                return
            }
            mergedLines.sort { a, b in
                nutritionLineSortKey(a) < nutritionLineSortKey(b)
            }
            completion(.success((mergedLines, mergedLines.joined(separator: "\n"))))
        }
    }

    private static func nutritionLineSortKey(_ line: String) -> Int {
        let l = line.lowercased()
        if l.contains("nutrition") { return 0 }
        if l.contains("calories") { return 1 }
        if l.contains("serving") { return 2 }
        if l.contains("total fat") { return 3 }
        if l.contains("total carb") { return 4 }
        if l.contains("protein") { return 5 }
        return 10
    }

    static func recognize(
        cgImage: CGImage,
        accurate: Bool,
        regionOfInterest: CGRect? = nil,
        completion: @escaping (Result<(lines: [String], fullText: String), Error>) -> Void
    ) {
        let request = VNRecognizeTextRequest { req, err in
            if let err = err {
                completion(.failure(err))
                return
            }
            guard let observations = req.results as? [VNRecognizedTextObservation] else {
                completion(.failure(NSError(domain: "NutritionLabelOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "No text found."])))
                return
            }
            let parsed = assembleOcrLines(from: observations)
            if parsed.lines.isEmpty {
                completion(.failure(NSError(domain: "NutritionLabelOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "No text found."])))
                return
            }
            completion(.success(parsed))
        }
        request.recognitionLevel = accurate ? .accurate : .fast
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = accurate ? 0.005 : 0.01
        request.customWords = [
            "Nutrition", "Facts", "Calories", "Protein", "Carbohydrate", "Carbohydrates",
            "Fat", "Sodium", "Serving", "Daily", "Value", "Fiber", "Sugars",
        ]
        if let roi = regionOfInterest {
            request.regionOfInterest = roi
        }

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                completion(.failure(error))
            }
        }
    }

    static func assembleOcrLines(from observations: [VNRecognizedTextObservation]) -> (lines: [String], fullText: String) {
        struct Row {
            var y: CGFloat
            var parts: [(x: CGFloat, text: String)]
        }
        var rows: [Row] = []
        let yThreshold: CGFloat = 0.022
        let columnSplit: CGFloat = 0.52

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
            let left = row.parts.filter { $0.x < columnSplit }.map(\.text)
            let right = row.parts.filter { $0.x >= columnSplit }.map(\.text).joined(separator: " ")
            let leftJoined = left.joined(separator: " ")
            let line: String
            if !left.isEmpty && isMostlyPercentColumn(right) {
                line = leftJoined
            } else if !leftJoined.isEmpty && isStandaloneCalorieAmount(right) {
                line = leftJoined.lowercased().contains("calories") ? "\(leftJoined) \(right)" : leftJoined
            } else if leftJoined.isEmpty && isStandaloneCalorieAmount(right) {
                line = "Calories \(right)"
            } else if !left.isEmpty && !right.isEmpty {
                line = "\(leftJoined) \(right)"
            } else {
                line = row.parts.map(\.text).joined(separator: " ")
            }
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || isPercentOnlyLine(trimmed) { continue }
            lines.append(trimmed)
        }
        return (lines, lines.joined(separator: "\n"))
    }

    private static func isStandaloneCalorieAmount(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.range(of: #"^\d{2,4}$"#, options: .regularExpression) != nil
    }

    private static func isMostlyPercentColumn(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return false }
        if t.range(of: #"^\d+\s*%(\s+\d+\s*%)*$"#, options: .regularExpression) != nil { return true }
        let tokens = t.split(separator: " ").map(String.init)
        if tokens.isEmpty { return false }
        let pct = tokens.filter { $0.hasSuffix("%") || $0 == "0%" }.count
        return Double(pct) / Double(tokens.count) >= 0.55
    }

    private static func isPercentOnlyLine(_ line: String) -> Bool {
        let lower = line.lowercased()
        if lower.contains("daily value") && !lower.contains("calories") && !lower.contains("fat") {
            return true
        }
        return isMostlyPercentColumn(line)
    }
}
