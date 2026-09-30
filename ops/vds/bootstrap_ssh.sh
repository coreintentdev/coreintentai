#!/usr/bin/env bash
# Cloud Agent: wire VDS SSH when ZYNTHIO_DC_SSH_KEY secret is set in Cursor environment.
set -euo pipefail

KEY_PATH="${HOME}/.ssh/zynthio_dc"
VDS_HOST="${ZYNTHIO_VDS_HOST:-100.121.107.112}"
VDS_USER="${ZYNTHIO_VDS_USER:-root}"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ -n "${ZYNTHIO_DC_SSH_KEY:-}" ]]; then
  printf '%s\n' "$ZYNTHIO_DC_SSH_KEY" > "$KEY_PATH"
  chmod 600 "$KEY_PATH"
  ssh-keyscan -H "$VDS_HOST" >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true
  echo "VDS SSH key installed for ${VDS_USER}@${VDS_HOST}"
  ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=12 \
    "${VDS_USER}@${VDS_HOST}" "df -h / | tail -1" && echo "VDS SSH OK" || echo "VDS SSH probe failed (Tailscale/public path)"
else
  echo "ZYNTHIO_DC_SSH_KEY not set — add once in Cursor environment secrets (do not paste in chat)."
fi
