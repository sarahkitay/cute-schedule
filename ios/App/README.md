# Open this folder in Xcode correctly

**Always open `App.xcworkspace` — never `App.xcodeproj`.**

Capacitor, Firebase, and RevenueCat are installed via CocoaPods. They only link when you use the **workspace**.

## Quick start

From the repo root:

```bash
npm run cap:ios
```

Or manually:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then in Xcode: **Product → Clean Build Folder**, then **Product → Build** (⌘B).

## If you see `No such module 'Capacitor'`

1. You opened **`App.xcodeproj`** by mistake — close it and open **`App.xcworkspace`**.
2. Run `pod install` in this directory (`ios/App`).
3. Clean build folder and rebuild.

Red squiggles in Cursor/VS Code on `import Capacitor` are normal until Xcode has built the workspace once; use Xcode to build and run on device.
