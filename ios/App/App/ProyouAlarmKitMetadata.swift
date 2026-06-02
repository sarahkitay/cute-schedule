#if canImport(AlarmKit)
import AlarmKit

struct ProyouAlarmMetadata: AlarmMetadata, Codable, Sendable {
    var proyouAlarmId: String = ""
}
#endif
