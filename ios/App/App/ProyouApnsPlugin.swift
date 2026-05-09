import Foundation
import Capacitor

/// Exposes the raw APNs device token from `AppDelegate` as lowercase hex (variable byte length from Apple).
@objc(ProyouApnsPlugin)
public class ProyouApnsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouApnsPlugin"
    public let jsName = "ProyouApns"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getDeviceTokenHex", returnType: CAPPluginReturnPromise),
    ]

    /// Always resolves so JS can show diagnostics (never silent empty from a reject).
    @objc func getDeviceTokenHex(_ call: CAPPluginCall) {
        let (hexOpt, byteCount) = ProyouApnsTokenStore.snapshot()
        let hex = hexOpt ?? ""
        let valid = Self.isValidApnsDeviceToken(byteCount: byteCount, hex: hex)
        call.resolve([
            "hex": hex,
            "byteCount": byteCount,
            "valid": valid,
        ])
    }

    /// Matches JS `isValidNormalizedIosDeviceToken`: even-length hex, 64…200 chars (32…100 bytes).
    private static func isValidApnsDeviceToken(byteCount: Int, hex: String) -> Bool {
        guard byteCount >= 32, byteCount <= 100 else { return false }
        guard hex.count == byteCount * 2, hex.count >= 64, hex.count <= 200, hex.count % 2 == 0 else { return false }
        let allowed = CharacterSet(charactersIn: "0123456789abcdef")
        return hex.unicodeScalars.allSatisfy { allowed.contains($0) }
    }
}
