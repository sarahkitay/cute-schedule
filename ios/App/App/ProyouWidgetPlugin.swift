import Foundation
import Capacitor
import WidgetKit

@objc(ProyouWidgetPlugin)
public class ProyouWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouWidgetPlugin"
    public let jsName = "ProyouWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateSnapshot", returnType: CAPPluginReturnPromise),
    ]

    @objc func updateSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("snapshot") else {
            call.reject("snapshot string required")
            return
        }
        ProyouWidgetStore.saveSnapshotJSON(json)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["ok": true])
    }
}
