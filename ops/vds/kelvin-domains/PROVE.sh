#!/usr/bin/env bash
# Read-only prove — run from Mac or VDS
VDS="${ZYNTHIO_VDS_ORIGIN:-5.189.143.170}"
for d in nica.futbol kel.dog kelvinjimenez.com kelinsongs.com kelvinjimenez.net kelinjimenez.com; do
  printf '%-22s ' "$d"
  curl -sS -H "Host: $d" "http://${VDS}/" 2>/dev/null | grep -o '<title>[^<]*' | head -1 || echo "FAIL"
done
