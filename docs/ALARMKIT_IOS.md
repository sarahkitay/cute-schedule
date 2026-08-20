# PROYOU morning alarms on iOS (AlarmKit)

## What you get

On **iOS 26+**, enabled PROYOU alarms sync to **AlarmKit** (Apple’s system alarm API). They behave much closer to the Clock app than a normal notification:

- Can alert through **Silent** and **Focus**
- **Lock Screen** and **Dynamic Island** UI
- **Math / action-required alarms:** play the wake-up game on the **lock screen** Live Activity (tap answers or puzzle tiles). No need to unlock or open PROYOU. Optional **Open app** if you prefer the in-app challenge.
- **Standard alarms:** **Stop** ends the alarm; **Open PROYOU** launches the app (`proyou://alarm?alarmId=<app alarm id>`).
- Built-in and **imported** sounds (MP3/M4A from Files) are copied to `Library/Sounds` at sync so AlarmKit plays your clip on the lock screen (up to ~30s).

On **iOS 18-25**, the app keeps using **local notifications** plus in-app ringing when you open PROYOU.

## User setup

1. Build and install a native iOS build (`npm run cap:sync:ios`, then Xcode → device).
2. Add or enable a morning alarm in **Timers → Alarms**.
3. When iOS asks, allow **alarms** for PROYOU (separate from notification permission).
4. Optional: **Settings → Notifications → PROYOU → Alarms** to confirm access.

## Developer setup

- `NSAlarmKitUsageDescription` in `ios/App/App/Info.plist`
- Native plugin: `ProyouAlarmKitPlugin` (see `docs/IOS_NATIVE_PLUGINS.md`)
- JS bridge: `src/nativeAlarmKit.js` → `resyncAlarmNotifications()` prefers AlarmKit on iOS 26+

Requires **Xcode 26** and **iOS 26 SDK** to compile AlarmKit code (`#if canImport(AlarmKit)`). Older Xcode builds skip AlarmKit and fall back to notifications only.

## Focus timers

Focus timers use AlarmKit's **timer** API. The lock-screen countdown requires:

- `AlarmPresentation` with **countdown** (not alert-only) in `ProyouAlarmKitScheduler.scheduleFocusTimer`
- A widget extension Live Activity: `ProyouAlarmLiveActivity.swift` (`ActivityConfiguration` for `AlarmAttributes<ProyouFocusTimerMetadata>`)
- `NSSupportsLiveActivities` in the main app `Info.plist`

After starting a timer, lock your phone. You should see the countdown on the Lock Screen and in Dynamic Island.

## Not the Clock app

AlarmKit does **not** add alarms inside Apple’s orange Clock app. They are **PROYOU alarms** managed by the system with Clock-like alerting.
