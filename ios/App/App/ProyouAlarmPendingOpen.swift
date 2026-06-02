import Foundation
import UIKit

/// Persists the app alarm id when AlarmKit intents open PROYOU (backup if URL routing is delayed).
enum ProyouAlarmPendingOpen {
    static let userDefaultsKey = "proyou_pending_alarm_open_v1"

    static func store(proyouAlarmId: String) {
        guard !proyouAlarmId.isEmpty else { return }
        UserDefaults.standard.set(proyouAlarmId, forKey: userDefaultsKey)
    }

    static func consume() -> String? {
        let id = UserDefaults.standard.string(forKey: userDefaultsKey)
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
        guard let id, !id.isEmpty else { return nil }
        return id
    }

    static func openURL(for proyouAlarmId: String) -> URL? {
        let encoded = proyouAlarmId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? proyouAlarmId
        return URL(string: "proyou://alarm?alarmId=\(encoded)")
    }

    @MainActor
    static func openApp(proyouAlarmId: String) async {
        store(proyouAlarmId: proyouAlarmId)
        guard let url = openURL(for: proyouAlarmId) else { return }
        await UIApplication.shared.open(url, options: [:])
    }
}
