#!/usr/bin/env bash
# ONE SHOT — Mac/COR terminal. Lands handover, applies Kelvin nginx fix, writes prove.
set -euo pipefail

KEY="${ZYNTHIO_DC_KEY:-$HOME/.ssh/zynthio_dc}"
VDS="${ZYNTHIO_VDS:-root@100.121.107.112}"
REPO="${COREINTENTAI:-$HOME/coreintentai}"
PROVE="${HOME}/Desktop/desk/PROVE-CURSOR-ALL-$(date +%Y%m%d).md"
PACK_DIR="$REPO/ops/handover/cursor-incidents-20261001"
VDS_PATH="/root/zynthio/desk/handover/cursor-incidents-20261001"
SSH=(ssh -i "$KEY" -o ServerAliveInterval=30 -o BatchMode=yes)
SCP=(scp -i "$KEY" -o ServerAliveInterval=30)

mkdir -p "$(dirname "$PROVE")"
exec > >(tee "$PROVE") 2>&1

echo "# PROVE Cursor ALL — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/coreintentdev/coreintentai.git "$REPO"
fi
cd "$REPO"
git fetch origin main
git checkout main
git pull origin main

echo "## 1. SSH"
"${SSH[@]}" "$VDS" 'echo ssh_ok'

echo "## 2. DISK"
"${SSH[@]}" "$VDS" 'df -h / /root /var/www 2>/dev/null; free -h | head -2'

echo "## 3. LAND handover pack"
"${SSH[@]}" "$VDS" "mkdir -p $(dirname "$VDS_PATH")"
"${SCP[@]}" -r "$PACK_DIR" "${VDS}:${VDS_PATH}"
"${SSH[@]}" "$VDS" "cd ${VDS_PATH} && sha256sum -c MANIFEST.sha256"

echo "## 4. Proton mirror"
if command -v rclone >/dev/null; then
  rclone copy "$PACK_DIR" "zyn-vault:desk/cursor-incidents-20261001" --checksum -v || echo "proton skip/fail"
else
  echo "rclone missing — proton skip"
fi

echo "## 5. Kelvin nginx apply (drop .net from git package)"
tar -C "$REPO/ops/vds/kelvin-domains" -cf - . | \
  "${SSH[@]}" "$VDS" 'mkdir -p /tmp/kelvin-domains && tar -xf - -C /tmp/kelvin-domains && bash /tmp/kelvin-domains/apply_on_vds.sh'

echo "## 6. Kelvin nginx live"
"${SSH[@]}" "$VDS" "nginx -T 2>/dev/null | grep -i kelvin | head -40 || true"

echo "## 7. Origin titles from VDS"
"${SSH[@]}" "$VDS" 'for d in kelvinjimenez.net kelvinjimenez.com kelinsongs.com nica.futbol; do
  printf "%s | " "$d"
  curl -sS -H "Host: $d" http://127.0.0.1/ | grep -o "<title>[^<]*" | head -1
done'

echo
echo "DONE. Prove: $PROVE"
