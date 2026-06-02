#!/bin/bash
# Double-click this file in Finder to open PROYOU in Xcode the correct way.
cd "$(dirname "$0")"
echo "Installing CocoaPods..."
pod install
echo ""
echo "Opening App.xcworkspace (white Xcode icon — NOT App.xcodeproj)"
open "App.xcworkspace"
