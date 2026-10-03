#!/usr/bin/env bash
# ONE SHOT — Mac only. Cloud cannot run this. Lands handover + proves VDS + disk.
set -euo pipefail

KEY="${ZYNTHIO_DC_KEY:-$HOME/.ssh/zynthio_dc}"
VDS="${ZYNTHIO_VDS:-root@100.121.107.112}"
REPO="${COREINTENTAI:-$HOME/coreintentai}"
BRANCH="${BRANCH:-cursorfix-kelvin-net-alias-238d}"
PROVE="${HOME}/Desktop/desk/PROVE-CURSOR-ALL-$(date +%Y%m%d).md"
PACK_DIR="$REPO/ops/handover/cursor-incidents-20261001"
VDS_PATH="/root/zynthio/desk/handover/cursor-incidents-20261001"

mkdir -p "$(dirname "$PROVE")"
exec > >(tee "$PROVE") 2>&1

echo "# PROVE Cursor ALL — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/coreintentdev/coreintentai.git "$REPO"
fi
cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "## 1. SSH"
ssh -i "$KEY" -o ServerAliveInterval=30 -o BatchMode=yes "$VDS" 'echo ssh_ok'

echo "## 2. DISK"
ssh -i "$KEY" "$VDS" 'df -h / /root /var/www 2>/dev/null; free -h | head -2'

echo "## 3. LAND handover pack"
ssh -i "$KEY" "$VDS" "mkdir -p $(dirname "$VDS_PATH")"
scp -i "$KEY" -o ServerAliveInterval=30 -r "$PACK_DIR" "${VDS}:${VDS_PATH}"
ssh -i "$KEY" "$VDS" "cd ${VDS_PATH} && sha256sum -c MANIFEST.sha256"

echo "## 4. Proton mirror (optional)"
if command -v rclone >/dev/null; then
  rclone copy "$PACK_DIR" "zyn-vault:desk/cursor-incidents-20261001" --checksum -v || echo "proton skip/fail"
else
  echo "rclone missing — proton skip"
fi

echo "## 5. Kelvin nginx live"
ssh -i "$KEY" "$VDS" "nginx -T 2>/dev/null | grep -E 'kelvin|server_name' | head -30 || true"

echo "## 6. Origin titles from VDS"
ssh -i "$KEY" "$VDS" 'for d in kelvinjimenez.net kelvinjimenez.com nica.futbol; do
  printf "%s | " "$d"
  curl -sS -H "Host: $d" http://127.0.0.1/ | grep -o "<title>[^<]*" | head -1
done'

echo
echo "DONE. Prove: $PROVE"
