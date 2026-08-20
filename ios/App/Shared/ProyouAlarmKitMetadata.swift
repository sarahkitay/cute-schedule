#if canImport(AlarmKit)
import AlarmKit

nonisolated struct ProyouAlarmMetadata: AlarmMetadata, Codable, Sendable {
    var proyouAlarmId: String = ""
    var alarmLabel: String = ""
    var wakeMode: String = "standard"
    var alarmKitUUID: String = ""
}

nonisolated struct ProyouFocusTimerMetadata: AlarmMetadata, Codable, Sendable {
    var sessionId: String = ""
    var label: String = "Focus timer"
}
#endif
