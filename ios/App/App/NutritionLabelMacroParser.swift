import Foundation

struct NutritionLabelMacros {
    var calories: Int?
    var protein: Int?
    var fat: Int?
    var carbs: Int?

    var foundCount: Int {
        [calories, protein, fat, carbs].compactMap { $0 }.filter { $0 > 0 }.count
    }

    var isComplete: Bool {
        calories != nil && calories! > 0 && protein != nil && fat != nil && carbs != nil
    }
}

enum NutritionLabelMacroParser {
    static func parse(text: String) -> NutritionLabelMacros {
        let lines = text
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let flat = lines.joined(separator: " ")

        var calories = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)calories\s*[:\s]*(\d{2,4})\b"#,
                #"(?i)\bcalories\s+(\d{2,4})\b"#,
                #"(?i)calories\b[^0-9]{0,40}(\d{2,3})\b"#,
                #"(?i)\b(\d{2,3})\s*%?\s*\*?\s*daily\s*value"#,
            ],
            min: 5,
            max: 9999
        )
        if calories == nil {
            for line in lines where line.range(of: #"^\d{2,3}$"#, options: .regularExpression) != nil {
                if let v = parseNum(line), v >= 50 && v <= 800 {
                    calories = v
                    break
                }
            }
        }

        let protein = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)protein\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)protein\s+(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 200
        ) ?? lineMacro(lines: lines, prefixes: ["protein"], max: 200)

        let fat = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 200
        ) ?? lineMacro(lines: lines, prefixes: ["total fat"], max: 200)

        let carbs = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 400
        ) ?? lineMacro(lines: lines, prefixes: ["total carb"], max: 400)

        var calOut = calories
        if calOut == nil, let p = protein, let f = fat, let c = carbs {
            let inferred = Int(round(Double(p) * 4 + Double(f) * 9 + Double(c) * 4))
            if inferred >= 5 && inferred <= 9999 { calOut = inferred }
        }

        return NutritionLabelMacros(calories: calOut, protein: protein, fat: fat, carbs: carbs)
    }

    private static func parseNum(_ raw: String) -> Int? {
        let cleaned = raw.replacingOccurrences(of: ",", with: ".")
        guard let m = cleaned.range(of: #"\d+(?:\.\d+)?"#, options: .regularExpression) else { return nil }
        guard let val = Double(cleaned[m]), val.isFinite else { return nil }
        return Int(round(val))
    }

    private static func firstMatchInt(in text: String, patterns: [String], min: Int, max: Int) -> Int? {
        for p in patterns {
            guard let re = try? NSRegularExpression(pattern: p) else { continue }
            let range = NSRange(text.startIndex..., in: text)
            guard let match = re.firstMatch(in: text, range: range), match.numberOfRanges > 1,
                  let r = Range(match.range(at: 1), in: text),
                  let v = parseNum(String(text[r])), v >= min && v <= max else { continue }
            return v
        }
        return nil
    }

    private static func lineMacro(lines: [String], prefixes: [String], max: Int) -> Int? {
        for line in lines {
            let lower = line.lowercased()
            guard prefixes.contains(where: { lower.contains($0) }) else { continue }
            guard let re = try? NSRegularExpression(pattern: #"(\d+(?:[.,]\d+)?)"#),
                  let match = re.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                  let r = Range(match.range(at: 1), in: line),
                  let v = parseNum(String(line[r])), v >= 0 && v <= max else { continue }
            return v
        }
        return nil
    }
}
