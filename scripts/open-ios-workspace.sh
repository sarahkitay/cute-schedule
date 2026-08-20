#!/bin/sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT/ios/App"

if [ ! -d "$IOS_DIR" ]; then
  echo "error: ios/App not found. Run from repo root." >&2
  exit 1
fi

cd "$IOS_DIR"

if ! command -v pod >/dev/null 2>&1; then
  echo "error: CocoaPods (pod) not found. Install: sudo gem install cocoapods" >&2
  exit 1
fi

echo "Installing CocoaPods (Capacitor, Firebase, etc.)..."
pod install

WORKSPACE="$IOS_DIR/App.xcworkspace"
if [ ! -d "$WORKSPACE" ]; then
  echo "error: $WORKSPACE missing after pod install." >&2
  exit 1
fi

echo "Opening App.xcworkspace (required for Capacitor - do NOT use App.xcodeproj)"
open "$WORKSPACE"
