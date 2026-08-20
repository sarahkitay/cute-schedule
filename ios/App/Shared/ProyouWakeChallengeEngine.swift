import Foundation

/// Generates easy wake-up rounds (mirrors JS WakeUpChallenge: 3 math, 3 riddles, puzzle, typing picks).
enum ProyouWakeChallengeEngine {
    static let mathRounds = 3
    static let riddleRounds = 3
    static let writingRounds = 2

    private static let riddles: [(q: String, a: String)] = [
        ("What gets wetter the more it dries?", "towel"),
        ("I have hands but cannot clap. What am I?", "clock"),
        ("What has to be broken before you can use it?", "egg"),
        ("The more you take, the more you leave behind. What are they?", "footsteps"),
        ("What can you catch but not throw?", "cold"),
    ]

    private static let writingPrompts = [
        "I am awake and ready",
        "Good morning world",
        "Today is a fresh start",
        "Rise and shine",
        "I choose to wake up now",
        "My brain is turned on",
    ]

    static func totalRounds(for mode: String) -> Int {
        switch mode {
        case "math_dismiss": return mathRounds
        case "riddle": return riddleRounds
        case "action_required": return writingRounds
        case "puzzle": return 1
        default: return 1
        }
    }

    static func needsChallenge(mode: String) -> Bool {
        ["math_dismiss", "riddle", "action_required", "puzzle"].contains(mode)
    }

    static func buildMathRound() -> (prompt: String, answer: String, choices: [String]) {
        let a = Int.random(in: 1...9)
        let b = Int.random(in: 1...9)
        let useAdd = Double.random(in: 0...1) > 0.35
        let answer: Int
        let prompt: String
        if useAdd {
            answer = a + b
            prompt = "\(a) + \(b) = ?"
        } else {
            let hi = max(a, b)
            let lo = min(a, b)
            answer = hi - lo
            prompt = "\(hi) - \(lo) = ?"
        }
        let correct = String(answer)
        var wrong = Set<String>()
        while wrong.count < 2 {
            let delta = Int.random(in: -3...3)
            let v = answer + delta
            if v >= 0 && v != answer { wrong.insert(String(v)) }
        }
        var choices = [correct] + Array(wrong)
        choices.shuffle()
        return (prompt, correct, choices)
    }

    static func buildRiddleRound(used: Set<String>) -> (question: String, answer: String, choices: [String]) {
        var pool = riddles.filter { !used.contains($0.a) }
        if pool.isEmpty { pool = riddles }
        let pick = pool.randomElement() ?? riddles[0]
        let correct = pick.a
        var distractors = Set<String>()
        for r in riddles.shuffled() where r.a != correct {
            distractors.insert(r.a)
            if distractors.count >= 2 { break }
        }
        while distractors.count < 2 {
            distractors.insert(["sun", "door", "key", "book"].randomElement() ?? "sun")
        }
        var choices = [correct] + Array(distractors.prefix(2))
        choices.shuffle()
        return (pick.q, correct, choices)
    }

    static func buildWritingRound(used: Set<String>) -> (prompt: String, answer: String, choices: [String]) {
        var pool = writingPrompts.filter { !used.contains($0) }
        if pool.isEmpty { pool = writingPrompts }
        let correct = pool.randomElement() ?? writingPrompts[0]
        var distractors = writingPrompts.filter { $0 != correct }.shuffled().prefix(2)
        if distractors.count < 2 {
            distractors = ["Time to sleep", "Good night moon"].prefix(2)
        }
        var choices = [correct] + Array(distractors)
        choices.shuffle()
        return (correct, correct, choices)
    }

    static func createPuzzleTiles() -> [Int] {
        var tiles = Array(1...8) + [0]
        tiles.shuffle()
        return tiles
    }

    static func puzzleSolved(_ tiles: [Int]) -> Bool {
        guard tiles.count == 9 else { return false }
        for i in 0..<8 where tiles[i] != i + 1 { return false }
        return tiles[8] == 0
    }

    static func puzzleNeighbors(_ idx: Int) -> [Int] {
        let row = idx / 3
        let col = idx % 3
        var out: [Int] = []
        if row > 0 { out.append(idx - 3) }
        if row < 2 { out.append(idx + 3) }
        if col > 0 { out.append(idx - 1) }
        if col < 2 { out.append(idx + 1) }
        return out
    }
}
