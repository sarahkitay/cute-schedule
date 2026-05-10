/**
 * Capacitor CLI regenerates `ios/App/App/capacitor.config.json` and sets `packageClassList` only from
 * npm iOS plugins (@capacitor/cli `writePluginJSON`). Optional local `CAPBridgedPlugin` classes can be merged via
 * `EXTRA_IOS_PACKAGE_CLASSES` so they stay registered after `cap sync`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CAP_FILE = path.join(ROOT, "ios", "App", "App", "capacitor.config.json");

/** @type {string[]} — @objc(…) names of CAPBridgedPlugin classes compiled into the App target */
const EXTRA_IOS_PACKAGE_CLASSES = [];

function main() {
  if (!fs.existsSync(CAP_FILE)) {
    console.warn("[merge-ios-cap-plugin-classes] skip: missing", CAP_FILE);
    return;
  }
  const raw = fs.readFileSync(CAP_FILE, "utf8");
  const json = JSON.parse(raw);
  const existing = Array.isArray(json.packageClassList) ? json.packageClassList : [];
  const merged = [...new Set([...existing, ...EXTRA_IOS_PACKAGE_CLASSES])];
  json.packageClassList = merged;
  fs.writeFileSync(CAP_FILE, `${JSON.stringify(json, null, "\t")}\n`, "utf8");
  console.log("[merge-ios-cap-plugin-classes] packageClassList:", merged.join(", "));
}

main();
