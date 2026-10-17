#!/usr/bin/env bash
# Starts the Firebase Emulator Suite, locating a Java 21+ runtime if the
# default `java` on PATH is older (firebase-tools 15 requires Java 21).
#
#   scripts/emulators.sh                 -> firebase emulators:start
#   scripts/emulators.sh exec "<cmd>"    -> firebase emulators:exec "<cmd>"
#
# Data is saved to firebase/emulator-data on exit and loaded on the next start,
# so seeding is only needed once. Delete that folder to start from scratch.
set -euo pipefail

cd "$(dirname "$0")/.."

java_major() {
  "$1" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/'
}

pick_java() {
  local candidates=(
    "${JAVA_HOME:-}/bin/java"
    "$(command -v java || true)"
    "/opt/homebrew/opt/openjdk@21/bin/java"
    "/opt/homebrew/opt/openjdk/bin/java"
    "/usr/local/opt/openjdk@21/bin/java"
    "/usr/local/opt/openjdk/bin/java"
  )
  if [ -x /usr/libexec/java_home ]; then
    local home
    home="$(/usr/libexec/java_home -v 21+ 2>/dev/null || true)"
    [ -n "$home" ] && candidates+=("$home/bin/java")
  fi
  for bin in "${candidates[@]}"; do
    if [ -n "$bin" ] && [ -x "$bin" ]; then
      local major
      major="$(java_major "$bin")"
      if [ "${major:-0}" -ge 21 ] 2>/dev/null; then
        echo "$bin"
        return 0
      fi
    fi
  done
  return 1
}

JAVA_BIN="$(pick_java || true)"
if [ -z "$JAVA_BIN" ]; then
  echo "A Java 21+ runtime is required for the Firebase emulators." >&2
  echo "Install one with: brew install openjdk@21   (macOS) or https://adoptium.net" >&2
  exit 1
fi
export PATH="$(dirname "$JAVA_BIN"):$PATH"

PROJECT="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-demo-cricscore}"
DATA_DIR="firebase/emulator-data"
PERSIST=(--export-on-exit="$DATA_DIR")
[ -d "$DATA_DIR" ] && PERSIST+=(--import="$DATA_DIR")

if [ "${1:-}" = "exec" ]; then
  shift
  exec npx firebase emulators:exec --project "$PROJECT" "${PERSIST[@]}" "$@"
fi
exec npx firebase emulators:start --project "$PROJECT" "${PERSIST[@]}" "$@"
