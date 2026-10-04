#!/usr/bin/env bash
# Read-only prove — run from Mac, Cloud, or VDS. Flags drift without SSH.
set -euo pipefail

VDS="${ZYNTHIO_VDS_ORIGIN:-5.189.143.170}"
DRIFT=0

title_for() {
  local d="$1"
  curl -sS -H "Host: $d" "http://${VDS}/" 2>/dev/null \
    | grep -o '<title>[^<]*' | head -1 || echo "FAIL"
}

echo "=== Kelvin / team origin probe (${VDS}) ==="
for d in nica.futbol kel.dog kelvinjimenez.com kelinsongs.com kelvinjimenez.net kelinjimenez.com; do
  title="$(title_for "$d")"
  printf '%-22s %s\n' "$d" "$title"
  case "$d" in
    kelvinjimenez.net|kelinjimenez.com)
      if echo "$title" | grep -q 'Real España SJDS'; then
        echo "  DRIFT: unauthorized alias serves team site — deploy kelvin fix on VDS"
        DRIFT=1
      fi
      ;;
    kelvinjimenez.com|kelinsongs.com)
      if echo "$title" | grep -q 'Real España SJDS'; then
        echo "  DRIFT: song domain serves team site — wrong nginx root"
        DRIFT=1
      fi
      ;;
  esac
done

exit "$DRIFT"
