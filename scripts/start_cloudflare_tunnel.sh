#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_PATH="${NETWORK_CONFIG_PATH:-${REPO_ROOT}/config/network-config.json}"
PORT="${PORT:-5000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[cloudflare] cloudflared CLI not found. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/."
  exit 1
fi

echo "[cloudflare] Using network config: ${CONFIG_PATH}"
if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "[cloudflare] Config file not found. Copy config/network-config.example.json to ${CONFIG_PATH} and edit the URLs before using this script."
  exit 1
fi

pushd "${REPO_ROOT}" >/dev/null

echo "[cloudflare] Building production bundle…"
npm run build >/dev/null

echo "[cloudflare] Starting API (PORT=${PORT})…"
NODE_ENV=production NETWORK_CONFIG_PATH="${CONFIG_PATH}" npm run start &
SERVER_PID=$!

cleanup() {
  echo
  echo "[cloudflare] Shutting down…"
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
}

trap cleanup INT TERM EXIT

echo "[cloudflare] Launching Cloudflare Tunnel (target http://localhost:${PORT})…"
echo "[cloudflare] Press Ctrl+C to stop both the server and the tunnel."
cloudflared tunnel --url "http://localhost:${PORT}"

popd >/dev/null
