import UIKit
import Capacitor
import WebKit

/// UIScene lifecycle for iOS 26+ readiness; `Main` storyboard still provides `CAPBridgeViewController` via Info.plist `UISceneStoryboardFile`.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// Warm canvas so overscroll / safe-area gaps never flash the iOS 26 system blue under-page color.
    private static let canvas = UIColor(red: 1.0, green: 0.973, blue: 0.969, alpha: 1.0)

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        applyCanvasColor()
        // WKWebView is often created after willConnect; paint again once it exists.
        paintCanvasSoon()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        applyCanvasColor()
        paintCanvasSoon()
    }

    private func paintCanvasSoon() {
        for delay in [0.05, 0.2, 0.6, 1.2] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.applyCanvasColor()
            }
        }
    }

    private func applyCanvasColor() {
        let color = Self.canvas
        window?.backgroundColor = color
        guard let root = window?.rootViewController else { return }
        paint(root, color: color)
    }

    private func paint(_ controller: UIViewController, color: UIColor) {
        controller.view.backgroundColor = color
        if let cap = controller as? CAPBridgeViewController {
            let web = cap.webView
            web?.isOpaque = true
            web?.backgroundColor = color
            web?.scrollView.backgroundColor = color
            web?.scrollView.contentInsetAdjustmentBehavior = .never
            if #available(iOS 15.0, *) {
                web?.underPageBackgroundColor = color
            }
        }
        for child in controller.children {
            paint(child, color: color)
        }
        if let presented = controller.presentedViewController {
            paint(presented, color: color)
        }
    }
}
