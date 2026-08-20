#if canImport(AlarmKit)
import AppIntents
import AlarmKit
import Foundation

@available(iOS 26.0, *)
private enum ProyouWakeChallengeFinish {
    static func complete(alarmKitId: String, proyouAlarmId: String) async {
        if let uuid = UUID(uuidString: alarmKitId) {
            try? AlarmManager.shared.stop(id: uuid)
        }
        if !proyouAlarmId.isEmpty {
            UserDefaults(suiteName: ProyouWidgetSnapshot.appGroupId)?
                .set(proyouAlarmId, forKey: "proyou_alarm_dismissed_pending_v1")
        }
        ProyouWakeChallengeStore.clear(alarmKitId: alarmKitId)
    }
}

@available(iOS 26.0, *)
struct ProyouWakeInitChallengeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Start wake-up game"
    static var description = IntentDescription("Prepare the lock-screen wake-up challenge")

    @Parameter(title: "AlarmKit id")
    var alarmKitId: String

    @Parameter(title: "PROYOU alarm id")
    var proyouAlarmId: String

    @Parameter(title: "Wake mode")
    var wakeMode: String

    init() {
        self.alarmKitId = ""
        self.proyouAlarmId = ""
        self.wakeMode = "standard"
    }

    init(alarmKitId: String, proyouAlarmId: String, wakeMode: String) {
        self.alarmKitId = alarmKitId
        self.proyouAlarmId = proyouAlarmId
        self.wakeMode = wakeMode
    }

    func perform() async throws -> some IntentResult {
        _ = ProyouWakeChallengeStore.ensureSession(
            alarmKitId: alarmKitId,
            proyouAlarmId: proyouAlarmId,
            mode: wakeMode
        )
        return .result()
    }
}

@available(iOS 26.0, *)
struct ProyouWakePickAnswerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Answer"
    static var description = IntentDescription("Submit a wake-up challenge answer")

    @Parameter(title: "AlarmKit id")
    var alarmKitId: String

    @Parameter(title: "Choice index")
    var choiceIndex: Int

    init() {
        self.alarmKitId = ""
        self.choiceIndex = 0
    }

    init(alarmKitId: String, choiceIndex: Int) {
        self.alarmKitId = alarmKitId
        self.choiceIndex = choiceIndex
    }

    func perform() async throws -> some IntentResult {
        guard let session = ProyouWakeChallengeStore.pickAnswer(
            alarmKitId: alarmKitId,
            choiceIndex: choiceIndex
        ) else {
            return .result()
        }
        if session.completed {
            await ProyouWakeChallengeFinish.complete(
                alarmKitId: session.alarmKitId,
                proyouAlarmId: session.proyouAlarmId
            )
        }
        return .result()
    }
}

@available(iOS 26.0, *)
struct ProyouWakePuzzleTapIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Move tile"
    static var description = IntentDescription("Move a puzzle tile on the lock screen")

    @Parameter(title: "AlarmKit id")
    var alarmKitId: String

    @Parameter(title: "Tile index")
    var tileIndex: Int

    init() {
        self.alarmKitId = ""
        self.tileIndex = 0
    }

    init(alarmKitId: String, tileIndex: Int) {
        self.alarmKitId = alarmKitId
        self.tileIndex = tileIndex
    }

    func perform() async throws -> some IntentResult {
        guard let session = ProyouWakeChallengeStore.tapPuzzle(
            alarmKitId: alarmKitId,
            tileIndex: tileIndex
        ) else {
            return .result()
        }
        if session.completed {
            await ProyouWakeChallengeFinish.complete(
                alarmKitId: session.alarmKitId,
                proyouAlarmId: session.proyouAlarmId
            )
        }
        return .result()
    }
}
#endif
