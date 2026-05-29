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
| `ProyouMusicPicker` | `ProyouMusicPickerPlugin` | Apple Music / library picker for alarm sounds |
| `ProyouNutritionLabel` | `ProyouNutritionLabelPlugin` | Camera scan + photo library + Vision OCR for nutrition labels |
| `ProyouWidget` | `ProyouWidgetPlugin` | Home Screen widget snapshot |
| `ProyouAlarmSound` | `ProyouAlarmSoundPlugin` | Native alarm audio |
| `ProyouApns` | `ProyouApnsPlugin` | Push token bridge |

Swift files live in `ios/App/App/`. Each plugin implements `CAPBridgedPlugin` with `jsName` matching the JS registration string.

## Nutrition label flow

1. **Scan with camera** → `scanLabel()` → `UIImagePickerController` (camera) → Apple Vision OCR → macros parsed in JS.
2. **Choose photo** → `pickLabelPhoto()` → photo library picker → same Vision OCR (no camera).
3. Web fallback uses file input; camera scan uses `capture` only for the initial “Scan nutrition label” action.

Permissions in `Info.plist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`.

## Apple Music picker flow

1. JS: `pickSongFromAppleMusicLibrary()` in `src/alarmMusicPicker.js`.
2. Native: `pickSong()` → `MPMediaPickerController` after Media Library authorization.
3. Permission: `NSAppleMusicUsageDescription`.

Requires a **real device**; picker is disabled on Simulator (`isAvailable` returns false).

## Adding a new plugin

1. Add `SomethingPlugin.swift` under `ios/App/App/` implementing `CAPBridgedPlugin` with `jsName`.
2. Add the file to the App target in Xcode (or `project.pbxproj`).
3. Add `"SomethingPlugin"` to `EXTRA_IOS_PACKAGE_CLASSES` in `scripts/merge-ios-cap-plugin-classes.mjs` and root `capacitor.config.json` `packageClassList`.
4. Run `npm run cap:sync:ios` and rebuild.
