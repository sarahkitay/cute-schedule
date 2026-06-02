#if canImport(AlarmKit)
import AppIntents
import AlarmKit

@available(iOS 26.0, *)
struct ProyouStopAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Stop"
    static var description = IntentDescription("Stop the PROYOU alarm")

    @Parameter(title: "AlarmKit id")
    var alarmKitId: String

    init() {
        self.alarmKitId = ""
    }

    init(alarmKitId: String) {
        self.alarmKitId = alarmKitId
    }

    func perform() async throws -> some IntentResult {
        guard let uuid = UUID(uuidString: alarmKitId) else { return .result() }
        if let proyouId = ProyouAlarmKitScheduler.proyouAlarmId(forKitUUID: alarmKitId) {
            ProyouAlarmPendingDismiss.store(proyouAlarmId: proyouId)
        }
        try AlarmManager.shared.cancel(id: uuid)
        try? await ProyouAlarmKitScheduler.resyncFromCachedAlarms()
        return .result()
    }
}

@available(iOS 26.0, *)
struct ProyouOpenAppAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Open PROYOU"
    static var description = IntentDescription("Open PROYOU to complete your wake-up challenge")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "PROYOU alarm id")
    var proyouAlarmId: String

    init() {
        self.proyouAlarmId = ""
    }

    init(proyouAlarmId: String) {
        self.proyouAlarmId = proyouAlarmId
    }

    func perform() async throws -> some IntentResult {
        await ProyouAlarmPendingOpen.openApp(proyouAlarmId: proyouAlarmId)
        return .result()
    }
}
#endif
