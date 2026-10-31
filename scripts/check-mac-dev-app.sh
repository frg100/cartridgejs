#!/usr/bin/env bash
# macOS CI check: `cartridge preview` must show the game name (not "Electron") in the menu bar.
# The menu bar uses the bundle name that Launch Services reports for the running app.
set -euo pipefail
cd "$(dirname "$0")/../examples/cube"
BUNDLE_ID=com.example.cubeclicker.dev
LOG="$(mktemp)"

pnpm exec cartridge preview --no-steam >"$LOG" 2>&1 &
PREVIEW_PID=$!
cleanup() { pkill -f "Cube Clicker.app/Contents/MacOS" || true; kill "$PREVIEW_PID" 2>/dev/null || true; }
trap cleanup EXIT

ASN=""
for _ in $(seq 1 60); do
  ASN="$(lsappinfo find bundleid="$BUNDLE_ID" 2>/dev/null || true)"
  [ -n "$ASN" ] && break
  sleep 1
done

echo "--- preview log"; cat "$LOG"
APP=".cartridge/dev/mac-app/Cube Clicker.app"
echo "--- dev app bundle"
/usr/libexec/PlistBuddy -c 'Print CFBundleName' "$APP/Contents/Info.plist"
codesign --verify --deep --strict "$APP" && echo "signature ok"

if [ -z "$ASN" ]; then
  echo "FAIL: no running app with bundle id $BUNDLE_ID"
  lsappinfo list | grep -iE 'electron|cube' || true
  exit 1
fi
echo "--- running app"; lsappinfo info "$ASN"
NAME="$(lsappinfo info -only name "$ASN")"
echo "$NAME"
echo "$NAME" | grep -q '"Cube Clicker"' && echo "OK: menu bar name is Cube Clicker" || { echo "FAIL: wrong name"; exit 1; }
