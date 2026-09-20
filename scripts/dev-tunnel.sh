#!/usr/bin/env bash
set -e

PORT="${PORT:-3001}"
MODE="${1:-all}"

# Find cloudflared binary
CLOUDFLARED_BIN="$(which cloudflared 2>/dev/null || true)"
if [ -z "$CLOUDFLARED_BIN" ] && [ -x "$HOME/.local/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
fi

# Auto-install cloudflared if missing
if [ -z "$CLOUDFLARED_BIN" ] || [ ! -x "$CLOUDFLARED_BIN" ]; then
  echo "📥 cloudflared not found. Downloading standalone binary to ~/.local/bin/cloudflared..."
  mkdir -p "$HOME/.local/bin"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    *) CF_ARCH="amd64" ;;
  esac
  curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" -o "$HOME/.local/bin/cloudflared"
  chmod +x "$HOME/.local/bin/cloudflared"
  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
  echo "✅ cloudflared installed successfully!"
fi

# Kill any stale tunnel process on the same port
pkill -f "cloudflared tunnel --url http://localhost:${PORT}" 2>/dev/null || true

TUNNEL_LOG=$(mktemp /tmp/cloudflared-XXXXXX.log)
TUNNEL_PID=""
DEV_PID=""

cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
  fi
  rm -f "$TUNNEL_LOG"
}

trap cleanup INT TERM EXIT

echo "🌐 Starting Cloudflare mobile tunnel for port ${PORT}..."
"$CLOUDFLARED_BIN" tunnel --url "http://localhost:${PORT}" > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Monitor tunnel log for public URL in background
(
  URL=""
  for i in $(seq 1 30); do
    if grep -q "trycloudflare.com" "$TUNNEL_LOG" 2>/dev/null; then
      URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1)
      if [ -n "$URL" ]; then
        echo ""
        echo "=========================================================================="
        echo "📱 Mobile / Remote Access (Cloudflare Tunnel):"
        echo "   🔗 $URL"
        echo "   Open this link on your phone (Safari / Chrome / Android / iOS)"
        echo "=========================================================================="
        echo ""
        break
      fi
    fi
    sleep 1
  done
  if [ -z "$URL" ]; then
    echo "⚠️  Cloudflare tunnel started (PID: $TUNNEL_PID). Waiting for connection..."
  fi
) &

if [ "$MODE" = "tunnel-only" ]; then
  echo "📡 Running in tunnel-only mode. Press Ctrl+C to stop."
  wait "$TUNNEL_PID"
else
  # Start Next.js dev server
  npm run dev &
  DEV_PID=$!
  wait "$DEV_PID"
fi
