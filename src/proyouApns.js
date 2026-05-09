import { registerPlugin } from "@capacitor/core";

const ProyouApns = registerPlugin("ProyouApns", {
  web: () => ({
    getDeviceTokenHex: async () => ({ hex: "", byteCount: 0, valid: false }),
  }),
});

/**
 * Reads the APNs device token captured in `AppDelegate` as lowercase hex (opaque length; often 64–200 chars).
 * `valid` matches native rules (even hex, bounds). `pluginError` is set if the plugin call throws.
 */
export async function getIosApnsDeviceTokenHexFromNative() {
  try {
    const r = await ProyouApns.getDeviceTokenHex();
    const hex = typeof r?.hex === "string" ? r.hex : "";
    const byteCount = typeof r?.byteCount === "number" ? r.byteCount : Number(r?.byteCount) || 0;
    const valid = r?.valid === true;
    return { hex, byteCount, valid, pluginError: null, pluginCode: null };
  } catch (e) {
    return {
      hex: "",
      byteCount: 0,
      valid: false,
      pluginError: e?.message != null ? String(e.message) : String(e),
      pluginCode: e?.code != null ? String(e.code) : null,
    };
  }
}
