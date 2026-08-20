import Foundation
import UIKit

/// Persists focus-timer dismiss/open when AlarmKit intents run from the lock screen.
enum ProyouFocusTimerPending {
    private static let dismissKey = "proyou_focus_timer_dismiss_pending_v1"
    private static let openKey = "proyou_focus_timer_open_pending_v1"

    static func storeDismiss(sessionId: String) {
        guard !sessionId.isEmpty else { return }
        UserDefaults.standard.set(sessionId, forKey: dismissKey)
    }

    static func consumeDismiss() -> String? {
        let id = UserDefaults.standard.string(forKey: dismissKey)
        UserDefaults.standard.removeObject(forKey: dismissKey)
        guard let id, !id.isEmpty else { return nil }
        return id
    }

    static func storeOpen(sessionId: String) {
        guard !sessionId.isEmpty else { return }
        UserDefaults.standard.set(sessionId, forKey: openKey)
    }

    static func consumeOpen() -> String? {
        let id = UserDefaults.standard.string(forKey: openKey)
        UserDefaults.standard.removeObject(forKey: openKey)
        guard let id, !id.isEmpty else { return nil }
        return id
    }

    static func openURL(for sessionId: String) -> URL? {
        let encoded = sessionId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sessionId
        return URL(string: "proyou://timer?sessionId=\(encoded)")
    }

    @MainActor
    static func openApp(sessionId: String) async {
        storeOpen(sessionId: sessionId)
        guard let url = openURL(for: sessionId) else { return }
        await UIApplication.shared.open(url, options: [:])
    }
}
