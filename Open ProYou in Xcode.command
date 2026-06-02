#!/bin/bash
cd "$(dirname "$0")/ios/App"
pod install
open App.xcworkspace
