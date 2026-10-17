#!/usr/bin/env bash
# `npm run dev`: the Next.js dev server plus a Cloudflare quick tunnel, so the
# app can be opened on a phone.
#
#   scripts/dev-tunnel.sh              -> dev server + tunnel (reuses a dev
#                                         server already running on PORT)
#   scripts/dev-tunnel.sh tunnel-only  -> tunnel to an already running server
#   npm run dev:no-tunnel              -> dev server only
#
# Without cloudflared, or when the app uses the local emulators (a phone can't
# reach them), it just starts the dev server.
#
# While the tunnel is up, its domain is added to the Firebase project's Auth
# authorized domains so Google sign-in works on the phone; it is removed again
# on exit. Quick tunnels get a new random URL every run.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3005}"
MODE="${1:-all}"

dev_only() {
  echo "$1"
  if [ "$MODE" = "tunnel-only" ]; then exit 1; fi
  exec ./node_modules/.bin/next dev -p "$PORT"
}

# Which env wins: .env.local overrides .env (same as Next.js).
uses_emulators() {
  local line
  line="$(grep -h "^NEXT_PUBLIC_FIREBASE_USE_EMULATOR=" .env.local .env 2>/dev/null | head -n 1 || true)"
  [ "${line#*=}" = "true" ]
}
if uses_emulators; then
  dev_only "The app uses the local emulators, which a phone can't reach through a tunnel; starting without one."
fi

CLOUDFLARED_BIN="$(command -v cloudflared || true)"
if [ -z "$CLOUDFLARED_BIN" ] && [ -x "$HOME/.local/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
fi
if [ -z "$CLOUDFLARED_BIN" ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    dev_only "cloudflared is not installed (brew install cloudflared); starting without a tunnel."
  fi
  echo "Downloading cloudflared to ~/.local/bin/cloudflared..."
  mkdir -p "$HOME/.local/bin"
  case "$(uname -m)" in
    aarch64 | arm64) CF_ARCH="arm64" ;;
    *) CF_ARCH="amd64" ;;
  esac
  curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o "$HOME/.local/bin/cloudflared"
  chmod +x "$HOME/.local/bin/cloudflared"
  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
fi

# Reuse a dev server that is already running instead of starting a second one.
if [ "$MODE" = "all" ] && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "A server is already running on port ${PORT}; tunnelling to it."
  MODE="tunnel-only"
fi

TUNNEL_LOG="$(mktemp -t cloudflared)"
URL_FILE="$(mktemp -t cloudflared-url)"
TUNNEL_PID=""
DEV_PID=""

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "Stopping..."
  local host
  host="$(cat "$URL_FILE" 2>/dev/null || true)"
  if [ -n "$host" ]; then
    node scripts/firebase-auth-domain.mjs remove "$host" || true
  fi
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG" "$URL_FILE"
}
trap cleanup INT TERM EXIT

echo "Starting Cloudflare tunnel to http://localhost:${PORT}..."
"$CLOUDFLARED_BIN" tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

(
  for _ in $(seq 1 60); do
    url="$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -n 1 || true)"
    if [ -n "$url" ]; then
      echo "${url#https://}" >"$URL_FILE"
      node scripts/firebase-auth-domain.mjs add "${url#https://}" || true
      echo ""
      echo "=========================================================================="
      echo "  Open on your phone: $url"
      echo "  (the address can take ~30s to start resolving; new URL on every run)"
      echo "=========================================================================="
      echo ""
      exit 0
    fi
    sleep 1
  done
  echo "Tunnel did not report a URL within 60s; see cloudflared output above." >&2
) &

if [ "$MODE" = "tunnel-only" ]; then
  echo "Tunnel only. Press Ctrl+C to stop."
  wait "$TUNNEL_PID"
else
  ./node_modules/.bin/next dev -p "$PORT" &
  DEV_PID=$!
  wait "$DEV_PID"
fi
