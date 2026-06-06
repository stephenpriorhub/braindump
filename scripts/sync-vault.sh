#!/usr/bin/env sh
set -eu
VAULT_PATH="${VAULT_PATH:-/data/vault}"
if [ -z "${BRAIN_REPO_URL:-}" ]; then echo "[sync-vault] BRAIN_REPO_URL not set"; exit 0; fi

case "$BRAIN_REPO_URL" in
  git@github.com:*) CLONE_URL="https://github.com/${BRAIN_REPO_URL#git@github.com:}" ;;
  *) CLONE_URL="$BRAIN_REPO_URL" ;;
esac
if [ -n "${GITHUB_TOKEN:-}" ]; then
  case "$CLONE_URL" in
    https://github.com/*) CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@${CLONE_URL#https://}" ;;
  esac
fi

mkdir -p "$(dirname "$VAULT_PATH")"

if [ -d "$VAULT_PATH/.git" ]; then
  echo "[sync-vault] Pulling..."
  git -C "$VAULT_PATH" config user.email "braindump@oxfordhub.app" 2>/dev/null || true
  git -C "$VAULT_PATH" config user.name "BrainDump" 2>/dev/null || true
  git -C "$VAULT_PATH" pull --ff-only 2>&1 || echo "[sync-vault] Pull failed"
elif [ -d "$VAULT_PATH" ] && [ "$(ls -A "$VAULT_PATH" 2>/dev/null)" ]; then
  echo "[sync-vault] Clearing corrupt vault and recloning..."
  rm -rf "$VAULT_PATH" && mkdir -p "$VAULT_PATH"
  git clone "$CLONE_URL" "$VAULT_PATH"
  git -C "$VAULT_PATH" config user.email "braindump@oxfordhub.app"
  git -C "$VAULT_PATH" config user.name "BrainDump"
else
  echo "[sync-vault] Cloning..."
  git clone "$CLONE_URL" "$VAULT_PATH"
  git -C "$VAULT_PATH" config user.email "braindump@oxfordhub.app"
  git -C "$VAULT_PATH" config user.name "BrainDump"
fi
echo "[sync-vault] Done"
