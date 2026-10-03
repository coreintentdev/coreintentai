#!/usr/bin/env bash
# Run ON MAC — lands handover-pack-20261001 on VDS + Proton mirror.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY="${ZYNTHIO_DC_KEY:-$HOME/.ssh/zynthio_dc}"
VDS="${ZYNTHIO_VDS:-root@100.121.107.112}"
VDS_PATH="${VDS_HANDOVER_PATH:-/root/zynthio/desk/handover/cursor-incidents-20261001}"
PROTON_REMOTE="${PROTON_RCLONE:-zyn-vault:desk/cursor-incidents-20261001}"
PROVE="${HOME}/Desktop/desk/PROVE-CURSOR-HANDOVER-LAND-$(date +%Y%m%d).md"

mkdir -p "$(dirname "$PROVE")"
{
  echo "# PROVE Cursor handover land — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## VDS"
  scp -i "$KEY" -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -r "$SCRIPT_DIR" "${VDS}:${VDS_PATH}"
  ssh -i "$KEY" -o ServerAliveInterval=30 -o ServerAliveCountMax=6 "$VDS" "cd ${VDS_PATH} && sha256sum -c MANIFEST.sha256"
  echo
  echo "## Proton"
  if command -v rclone >/dev/null; then
    rclone copy "$SCRIPT_DIR" "$PROTON_REMOTE" --checksum -v
    rclone md5sum "$PROTON_REMOTE" | head -20
  else
    echo "rclone not found — Proton skip"
  fi
} 2>&1 | tee "$PROVE"

echo "Done. Prove: $PROVE"
