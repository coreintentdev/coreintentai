#!/usr/bin/env bash
# Run ON MAC — review VDS local paths (pcworkspace / zynthio desk). Read-only.
set -euo pipefail

KEY="${ZYNTHIO_DC_KEY:-$HOME/.ssh/zynthio_dc}"
VDS="${ZYNTHIO_VDS:-root@100.121.107.112}"
OUT="${HOME}/Desktop/desk/PROVE-VDS-PCWORKSPACE-REVIEW-$(date +%Y%m%d).md"

mkdir -p "$(dirname "$OUT")"
{
  echo "# VDS local file review — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  ssh -i "$KEY" "$VDS" 'bash -s' <<'REMOTE'
set -euo pipefail
echo "## Disk"
df -h / /root /var/www /root/proton 2>/dev/null || df -h /
echo
echo "## Search pcworkspace (name)"
find /root /var/www -maxdepth 4 -iname '*pcworkspace*' 2>/dev/null | head -50
echo
echo "## zynthio desk / handover"
ls -la /root/zynthio/desk/handover 2>/dev/null | tail -20 || echo "(missing)"
echo
echo "## cursor-incidents land (if landed)"
ls -la /root/zynthio/desk/handover/cursor-incidents-20261001 2>/dev/null || echo "(not landed yet)"
echo
echo "## _meta outputs"
ls -la /root/zynthio/_meta/*.md 2>/dev/null | tail -10 || true
echo
echo "## nginx kelvin (live)"
nginx -T 2>/dev/null | grep -E 'server_name|kelvin' | head -30 || true
REMOTE
} 2>&1 | tee "$OUT"

echo "Review saved: $OUT"
