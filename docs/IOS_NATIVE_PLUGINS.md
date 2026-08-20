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

## Focus timers (AlarmKit, iOS 26+)

Focus timers from **Timers** or **Start timer** on a task use AlarmKit's **timer** API (not a notification):

- Countdown on **Lock Screen** and **Dynamic Island** via `ProyouAlarmLiveActivity.swift` (Live Activity in the widget extension)
- Full-screen system alert with **Stop** when time is up (like Clock)
- **Open PROYOU** opens the app to dismiss from the in-app **Dismiss** button

Host app needs `NSSupportsLiveActivities` in `Info.plist`. Rebuild from Xcode after pulling these changes.

On **iOS 18-25**, focus timers fall back to local notifications plus in-app ringing.

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

## Archive fails: `No space left on device`

If archiving shows **`unable to open output file … ModuleCache.noindex … No space left on device`** or **`Could not build module 'UIKit'`**, the Mac disk is full. Xcode needs **several GB free** for Derived Data, module caches, and the archive `.ipa`.

Check free space:

```bash
df -h /
```

Free space safely (biggest wins first):

```bash
# 1. Remove unavailable iOS simulators (~often 10–30 GB)
xcrun simctl delete unavailable

# 2. Clear Xcode build caches (~5–10 GB; rebuild takes longer once)
rm -rf ~/Library/Developer/Xcode/DerivedData

# 3. Old archives you no longer need (check dates in Xcode → Window → Organizer)
rm -rf ~/Library/Developer/Xcode/Archives/*

# 4. Optional: old device support symbols (Xcode re-downloads when needed)
# rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*
```

Then **Product → Clean Build Folder** and archive again. Aim for **at least 15–20 GB free** before archiving.

**Important:** Clean Build Folder does **not** clear the module cache. If you see **`not a valid precompiled module file`** or **`file too small to contain AST file magic`** after a disk-full build, wipe caches manually:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

Quit Xcode first, run those commands, reopen `App.xcworkspace`, then **Product → Archive**.

The `WKProcessPool` Capacitor warning is unrelated to this error.

## Yellow warnings vs red errors

Xcode’s **Issue navigator** lists warnings (yellow) and errors (red) together. Paths under `node_modules/`, `Pods/`, or **CapacitorFirebase\*** are **third-party code**, not PROYOU.

**If the build finishes with “Build Succeeded”**, the app is fine - those messages are noise.

To hide warnings while developing:

1. Issue navigator filter: **Errors Only** (dropdown at the bottom of the list).
2. Or run `cd ios/App && pod install` after pulling - the Podfile sets **`SWIFT_SUPPRESS_WARNINGS`** and **`GCC_WARN_INHIBIT_ALL_WARNINGS`** on pod targets so most dependency warnings stop appearing on the next clean build.

**Pods → “Update to recommended settings”** is optional. You can ignore it, or update the **Pods** project only - do not re-enable **User Script Sandboxing** on the **App** target (that breaks `[CP] Embed Pods Frameworks`).

| Message | Source | Blocks build? |
|---------|--------|----------------|
| `WKProcessPool` is deprecated | Capacitor Cordova | No |
| Firebase `deprecated` / `@_implementationOnly` | Firebase pods | No |
| RevenueCat / Capacitor plugin deprecations | npm Capacitor plugins | No |
| `Update to recommended settings` (Pods) | Xcode UI suggestion | No |

## `PhaseScriptExecution` failed (`[CP] Embed Pods Frameworks`)

If the log shows **`Pods-App-frameworks.sh: Operation not permitted`** or the embed phase fails with no Swift error, **User Script Sandboxing** is blocking CocoaPods. This project sets **`ENABLE_USER_SCRIPT_SANDBOXING = NO`** in `App.xcodeproj` and the Podfile.

If Xcode prompts **Update to recommended settings** and re-enables sandboxing, either decline that change for the App project or set **Build Settings → User Script Sandboxing → No** on the **App** target, then **Clean Build Folder** and rebuild.

```bash
cd ios/App && pod install
```

## `ProyouWidgetExtension`: CodeSign failed

This is the **only error that stops the build** in the list above. Common causes on a **physical device** build:

1. **Wrong Xcode project** - open `ios/App/App.xcworkspace`, not `App.xcodeproj`.
2. **Team not set on the widget** - in Xcode, select target **ProyouWidgetExtension** → **Signing & Capabilities** → enable **Automatically manage signing** and choose the same **Team** as the **App** target.
3. **App Group not registered** - both bundle IDs need the group `group.app.proyou.proyou`:
   - `app.proyou.proyou` (main app)
   - `app.proyou.proyou.ProyouWidget` (widget extension)  
   In [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list), enable **App Groups** on both IDs and assign the same group. Then in Xcode: **Signing & Capabilities** → **App Groups** → check `group.app.proyou.proyou` on **App** and **ProyouWidgetExtension**.
4. **Stale profiles** - Xcode → **Settings → Accounts** → your Apple ID → **Download Manual Profiles**, then **Product → Clean Build Folder** and rebuild.
5. **Version mismatch** - extension `CFBundleVersion` must match the app (both use `CURRENT_PROJECT_VERSION` in the project).

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
