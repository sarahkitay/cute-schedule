import UIKit

/// UIScene lifecycle for iOS 26+ readiness; `Main` storyboard still provides `CAPBridgeViewController` via Info.plist `UISceneStoryboardFile`.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
}
