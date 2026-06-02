# iOS native plugins (Apple Music, nutrition labels, widgets, alarms)

PROYOU ships several **custom Capacitor plugins** compiled into the Xcode app target. They are **not** npm packages, so Capacitor’s default `cap sync` does **not** register them unless you merge `packageClassList`.

## Why you see “plugin is not implemented”

JavaScript calls `registerPlugin("ProyouNutritionLabel")` (or `ProyouMusicPicker`, etc.). Capacitor only loads native code when the plugin’s **Objective-C class name** appears in:

`ios/App/App/capacitor.config.json` → `packageClassList`

Running plain `npx cap sync ios` **overwrites** that file and drops custom entries. The app then builds, but native methods are missing → **“ProyouMusicPicker plugin is not implemented on ios”** (same for other custom plugins).

## Fix (sync + rebuild)

From the repo root:

```bash
npm run cap:sync:ios
```

That runs: build → `cap sync ios`. The `capacitor:sync:after` script in `package.json` automatically runs `scripts/merge-ios-cap-plugin-classes.mjs` so custom plugins stay registered even if you use plain `npx cap sync ios`.

If you already synced without rebuilding, only merge:

```bash
npm run cap:merge-ios-plugins
```

Xcode also runs the merge script in a **“Merge Capacitor iOS plugins”** build phase before Resources, so opening the project and building still picks up `packageClassList` even if you skipped `cap sync`.

Then in Xcode: **Product → Clean Build Folder**, rebuild, and run on a **physical iPhone** (camera / music library do not work fully in Simulator).

## Plugin map

| JS `registerPlugin` name | Swift class (`@objc`) | Purpose |
|--------------------------|------------------------|---------|
| `ProyouMusicPicker` | `ProyouMusicPickerPlugin` | (Legacy) Music library picker, not exposed in UI; alarms use **Choose from Files** |
| `ProyouNutritionLabel` | `ProyouNutritionLabelPlugin` | Camera scan + photo library + Vision OCR for nutrition labels |
| `ProyouWidget` | `ProyouWidgetPlugin` | Home Screen widget snapshot |
| `ProyouAlarmSound` | `ProyouAlarmSoundPlugin` | Native alarm audio |
| `ProyouAlarmKit` | `ProyouAlarmKitPlugin` | iOS 26+ system alarms (AlarmKit) |
| `ProyouApns` | `ProyouApnsPlugin` | Push token bridge |

Swift files live in `ios/App/App/`. Each plugin implements `CAPBridgedPlugin` with `jsName` matching the JS registration string.

## Nutrition label flow

1. **Scan label** → `scanLabel()` → full-screen live scanner (`NutritionLabelScannerViewController`): camera preview, Nutrition Facts frame, live Cal/Pro/Fat/Carb HUD, single capture button (no multi-page document scan).
2. **Choose photo** → `pickLabelPhoto()` → photo library → Vision OCR (full image, no crop ROI - better for curved bottle labels).
3. Accurate capture runs Vision without region-of-interest; live preview uses fast OCR inside the guide frame only.
3. Web fallback uses file input; camera scan uses `capture` only for the initial “Scan nutrition label” action.

Permissions in `Info.plist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`.

## Morning alarms (AlarmKit, iOS 26+)

1. JS: `resyncAlarmNotifications()` in `src/nativeAlarmNotifications.js` → `resyncAlarmKit()` when `ProyouAlarmKit.isAvailable()` is true.
2. Native: `ProyouAlarmKitPlugin` schedules via `AlarmManager` (weekly repeat, Lock Screen alert).
3. **Open PROYOU** on the system alarm UI runs `ProyouOpenAppAlarmIntent` → `proyou://alarm?alarmId=…` → wake-up challenge in the app.
4. iOS 18-25: falls back to Capacitor **local notifications** (no AlarmKit).

Permission: `NSAlarmKitUsageDescription` in `Info.plist`. User must allow **alarms** for PROYOU in Settings.

See [ALARMKIT_IOS.md](./ALARMKIT_IOS.md).

## Custom alarm audio

1. User imports MP3/M4A via **Choose from Files** in Timers (`src/components/TimersPage.jsx`).
2. `installCustomSoundForAlarmKit()` copies the clip into `Library/Sounds` for AlarmKit.

## Apple Music picker (legacy, not in UI)

1. JS: `pickSongFromAppleMusicLibrary()` in `src/alarmMusicPicker.js` (DRM limits apply).
2. Native: `pickSong()` → `MPMediaPickerController` after Media Library authorization.
3. Permission: `NSAppleMusicUsageDescription`.

Requires a **real device**; picker is disabled on Simulator (`isAvailable` returns false).

## Adding a new plugin

1. Add `SomethingPlugin.swift` under `ios/App/App/` implementing `CAPBridgedPlugin` with `jsName`.
2. Add the file to the App target in Xcode (or `project.pbxproj`).
3. Add `"SomethingPlugin"` to `EXTRA_IOS_PACKAGE_CLASSES` in `scripts/merge-ios-cap-plugin-classes.mjs` and root `capacitor.config.json` `packageClassList`.
4. Run `npm run cap:sync:ios` and rebuild.

## Xcode: “Unable to find module Capacitor / Firebase”

Those errors mean CocoaPods frameworks are not built yet, or Xcode opened the wrong project file.

1. **Open the workspace**, not the project: `ios/App/App.xcworkspace` (not `App.xcodeproj`).
2. From the repo root after web changes: `npm run cap:sync:ios` (or at least `cd ios/App && pod install`).
3. In Xcode: **Product → Clean Build Folder**, then build again (⌘B).
4. For a real device test, select your **iPhone** as the run destination (some plugins need a device).

The “Search path … Debug-iphonesimulator/Capacitor not found” messages usually clear after step 2-3. They appear when indexing runs before Pods have been compiled once.

Optional: delete stale Derived Data for this app (**Xcode → Settings → Locations → Derived Data → delete the App-* folder**), then rebuild.

## Xcode warnings you can ignore

These come from **dependencies**, not PROYOU app code:

| Message | Source |
|---------|--------|
| `WKProcessPool` is deprecated (iOS 15) | Capacitor Cordova (`node_modules/@capacitor/ios/.../CDVWebViewProcessPoolFactory.h`) |
| `@_implementationOnly` / library evolution | Firebase pods (`Pods/FirebaseAuth`, `FirebaseCoreInternal`) |
| `weakSelf` was never mutated | FirebaseAuth (pod source) |

They do not block the build. Upgrading Capacitor/Firebase later may reduce noise.

## `ProyouWidgetExtension`: CodeSign failed

This is the **only error that stops the build** in the list above. Common causes on a **physical device** build:

1. **Wrong Xcode project** — open `ios/App/App.xcworkspace`, not `App.xcodeproj`.
2. **Team not set on the widget** — in Xcode, select target **ProyouWidgetExtension** → **Signing & Capabilities** → enable **Automatically manage signing** and choose the same **Team** as the **App** target.
3. **App Group not registered** — both bundle IDs need the group `group.app.proyou.proyou`:
   - `app.proyou.proyou` (main app)
   - `app.proyou.proyou.ProyouWidget` (widget extension)  
   In [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list), enable **App Groups** on both IDs and assign the same group. Then in Xcode: **Signing & Capabilities** → **App Groups** → check `group.app.proyou.proyou` on **App** and **ProyouWidgetExtension**.
4. **Stale profiles** — Xcode → **Settings → Accounts** → your Apple ID → **Download Manual Profiles**, then **Product → Clean Build Folder** and rebuild.
5. **Version mismatch** — extension `CFBundleVersion` must match the app (both use `CURRENT_PROJECT_VERSION` in the project).

After changing the Podfile team helper, run:

```bash
cd ios/App && pod install
```

If your Apple team ID is not `HF3AKH98PY`, set it when installing pods:

```bash
PROYOU_DEVELOPMENT_TEAM=YOUR_TEAM_ID pod install
```

Also set **Team** on **App** and **ProyouWidgetExtension** in Xcode to that same team.

**Simulator** builds usually succeed even when device signing is misconfigured; use a real iPhone run to verify signing.
