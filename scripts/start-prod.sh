#!/usr/bin/env sh
export HOSTNAME=0.0.0.0
if [ -n "${BRAIN_REPO_URL:-}" ]; then
  echo "[start] Syncing vault..."
  sh scripts/sync-vault.sh >> /tmp/sync-vault.log 2>&1
fi
exec node .next/standalone/server.js
