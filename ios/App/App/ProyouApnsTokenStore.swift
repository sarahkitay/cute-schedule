import Foundation

/// Holds the last `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)` token from Apple.
/// APNs **device** token is opaque variable-length `Data` (encoded here as lowercase hex), not `APNS_PRIVATE_KEY` (.p8).
enum ProyouApnsTokenStore {
    private static let lock = NSLock()
    private static var _hex: String?
    private static var _byteCount: Int = 0

    static func update(deviceToken: Data) {
        let n = deviceToken.count
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        lock.lock()
        _byteCount = n
        _hex = hex
        lock.unlock()
        NSLog("[PROYOU] APNs deviceToken bytes=%d hexChars=%d", n, hex.count)
    }

    static func snapshot() -> (hex: String?, byteCount: Int) {
        lock.lock()
        let h = _hex
        let b = _byteCount
        lock.unlock()
        return (h, b)
    }
}
