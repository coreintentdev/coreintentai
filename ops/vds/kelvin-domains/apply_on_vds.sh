#!/usr/bin/env bash
# Run ON VDS (or: ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 'bash -s' < apply_on_vds.sh)
# Wires Kelvin Jiménez song domains off youlittledev default. Does NOT touch nica.futbol (team).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITES_ROOT="/root/sites"
NGINX_AVAIL="/etc/nginx/sites-available/kelvin-domains.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/kelvin-domains.conf"

echo "=== Kelvin domains deploy ==="
mkdir -p "${SITES_ROOT}/kelvinjimenez.com" "${SITES_ROOT}/kelinsongs.com"
cp -f "${SCRIPT_DIR}/sites/kelvinjimenez.com/index.html" "${SITES_ROOT}/kelvinjimenez.com/"
cp -f "${SCRIPT_DIR}/sites/kelinsongs.com/index.html" "${SITES_ROOT}/kelinsongs.com/"
cp -f "${SCRIPT_DIR}/nginx/kelvin-domains.conf" "${NGINX_AVAIL}"
ln -sf "${NGINX_AVAIL}" "${NGINX_ENABLED}"

nginx -t
systemctl reload nginx

echo "=== Prove (origin) ==="
for d in kelvinjimenez.com kelinsongs.com nica.futbol kel.dog; do
  title=$(curl -sS -H "Host: ${d}" http://127.0.0.1/ | grep -o '<title>[^<]*' | head -1 || true)
  echo "${d}: ${title}"
done
echo "Done. Save output to Desktop/desk/PROVE-KELVIN-DOMAINS-$(date +%Y%m%d).md"
