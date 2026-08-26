import Foundation

struct ProyouWakeChallengeRound: Codable, Equatable {
    var prompt: String = ""
    var answer: String = ""
    var choices: [String] = []
    var puzzleTiles: [Int] = []
}

struct ProyouWakeChallengeSession: Codable, Equatable {
    var alarmKitId: String = ""
    var proyouAlarmId: String = ""
    var mode: String = "standard"
    var round: Int = 0
    var totalRounds: Int = 1
    var current: ProyouWakeChallengeRound = .init()
    var usedRiddleAnswers: [String] = []
    var usedWritingPrompts: [String] = []
    var completed: Bool = false
    var lastError: String = ""
    var revision: Int = 0
}

enum ProyouWakeChallengeStore {
    static let appGroupId = ProyouWidgetStore.appGroupId
    private static let keyPrefix = "proyou_wake_challenge_v1_"

    private static func defaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func sessionKey(alarmKitId: String) -> String {
        keyPrefix + alarmKitId
    }

    static func load(alarmKitId: String) -> ProyouWakeChallengeSession? {
        guard !alarmKitId.isEmpty,
              let data = defaults()?.data(forKey: sessionKey(alarmKitId: alarmKitId))
        else { return nil }
        return try? JSONDecoder().decode(ProyouWakeChallengeSession.self, from: data)
    }

    static func save(_ session: ProyouWakeChallengeSession) {
        guard !session.alarmKitId.isEmpty,
              let data = try? JSONEncoder().encode(session)
        else { return }
        defaults()?.set(data, forKey: sessionKey(alarmKitId: session.alarmKitId))
    }

    static func clear(alarmKitId: String) {
        defaults()?.removeObject(forKey: sessionKey(alarmKitId: alarmKitId))
    }

    static func ensureSession(
        alarmKitId: String,
        proyouAlarmId: String,
        mode: String
    ) -> ProyouWakeChallengeSession {
        if var existing = load(alarmKitId: alarmKitId),
           existing.mode == mode,
           !existing.completed {
            return existing
        }
        var session = ProyouWakeChallengeSession(
            alarmKitId: alarmKitId,
            proyouAlarmId: proyouAlarmId,
            mode: mode,
            round: 0,
            totalRounds: ProyouWakeChallengeEngine.totalRounds(for: mode),
            completed: false
        )
        session.current = makeRound(for: &session)
        save(session)
        return session
    }

    static func makeRound(for session: inout ProyouWakeChallengeSession) -> ProyouWakeChallengeRound {
        switch session.mode {
        case "math_dismiss":
            let m = ProyouWakeChallengeEngine.buildMathRound()
            return ProyouWakeChallengeRound(prompt: m.prompt, answer: m.answer, choices: m.choices)
        case "riddle":
            let used = Set(session.usedRiddleAnswers)
            let r = ProyouWakeChallengeEngine.buildRiddleRound(used: used)
            session.usedRiddleAnswers.append(r.answer)
            return ProyouWakeChallengeRound(prompt: r.question, answer: r.answer, choices: r.choices)
        case "action_required":
            let used = Set(session.usedWritingPrompts)
            let w = ProyouWakeChallengeEngine.buildWritingRound(used: used)
            session.usedWritingPrompts.append(w.answer)
            return ProyouWakeChallengeRound(prompt: w.prompt, answer: w.answer, choices: w.choices)
        case "puzzle":
            return ProyouWakeChallengeRound(puzzleTiles: ProyouWakeChallengeEngine.createPuzzleTiles())
        default:
            return ProyouWakeChallengeRound()
        }
    }

    static func pickAnswer(alarmKitId: String, choiceIndex: Int) -> ProyouWakeChallengeSession? {
        guard var session = load(alarmKitId: alarmKitId), !session.completed else { return nil }
        let choices = session.current.choices
        guard choiceIndex >= 0, choiceIndex < choices.count else { return session }
        let picked = choices[choiceIndex].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let expected = session.current.answer.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if picked != expected {
            session.lastError = "Try again"
            session.revision += 1
            session.current = makeRound(for: &session)
            save(session)
            return session
        }
        session.lastError = ""
        let nextRound = session.round + 1
        if nextRound >= session.totalRounds {
            session.completed = true
            session.round = nextRound
            save(session)
            return session
        }
        session.round = nextRound
        session.current = makeRound(for: &session)
        session.revision += 1
        save(session)
        return session
    }

    static func tapPuzzle(alarmKitId: String, tileIndex: Int) -> ProyouWakeChallengeSession? {
        guard var session = load(alarmKitId: alarmKitId),
              session.mode == "puzzle",
              !session.completed else { return nil }
        var tiles = session.current.puzzleTiles
        guard tiles.count == 9, tileIndex >= 0, tileIndex < 9 else { return session }
        guard let blank = tiles.firstIndex(of: 0),
              ProyouWakeChallengeEngine.puzzleNeighbors(blank).contains(tileIndex) else {
            session.lastError = "Tap a tile next to the empty space"
            session.revision += 1
            save(session)
            return session
        }
        tiles[blank] = tiles[tileIndex]
        tiles[tileIndex] = 0
        session.current.puzzleTiles = tiles
        session.lastError = ""
        if ProyouWakeChallengeEngine.puzzleSolved(tiles) {
            session.completed = true
        }
        session.revision += 1
        save(session)
        return session
    }
}
