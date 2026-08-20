import Foundation

/// Written when the user stops a standard alarm from the lock screen (AlarmKit Stop intent).
enum ProyouAlarmPendingDismiss {
    static let userDefaultsKey = "proyou_alarm_dismissed_pending_v1"

    static func store(proyouAlarmId: String) {
        guard !proyouAlarmId.isEmpty else { return }
        UserDefaults.standard.set(proyouAlarmId, forKey: userDefaultsKey)
        UserDefaults(suiteName: ProyouWidgetSnapshot.appGroupId)?
            .set(proyouAlarmId, forKey: userDefaultsKey)
    }

    static func consume() -> String? {
        let fromGroup = UserDefaults(suiteName: ProyouWidgetSnapshot.appGroupId)?
            .string(forKey: userDefaultsKey)
        if let fromGroup, !fromGroup.isEmpty {
            UserDefaults(suiteName: ProyouWidgetSnapshot.appGroupId)?.removeObject(forKey: userDefaultsKey)
            UserDefaults.standard.removeObject(forKey: userDefaultsKey)
            return fromGroup
        }
        let id = UserDefaults.standard.string(forKey: userDefaultsKey)
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
        guard let id, !id.isEmpty else { return nil }
        return id
    }
}
