#!/usr/bin/env bash
# Run ON VDS as root — lands all workspace threads locally (no Cloud SSH needed).
# Respects: NEVER touch /root/silver_bot/ (Hermes). Kelvin apply is scoped only.
set -euo pipefail

REPO="${COREINTENTAI:-/tmp/coreintentai-handover}"
PACK_SRC="$REPO/ops/handover/cursor-incidents-20261001"
VDS_PATH="/root/zynthio/desk/handover/cursor-incidents-20261001"
DESK="/root/zynthio/desk"
PROVE="${DESK}/PROVE-CURSOR-HANDOVER-VDS-$(date +%Y%m%d).md"
THREAD_STATUS="${DESK}/THREAD-HANDOVER-STATUS-$(date +%Y%m%d).md"

mkdir -p "$DESK" "$(dirname "$VDS_PATH")"
exec > >(tee "$PROVE") 2>&1

echo "# PROVE VDS handover — all workspace threads — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "host: $(hostname -f 2>/dev/null || hostname)"
echo

echo "## 1. Clone / update repo"
if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/coreintentdev/coreintentai.git "$REPO"
fi
cd "$REPO"
git fetch origin main
git checkout main
git pull origin main
echo "repo: $(git rev-parse --short HEAD)"
echo

echo "## 2. Disk (thread: capacity)"
df -h / /root /var/www 2>/dev/null || df -h /
free -h 2>/dev/null | head -2 || true
echo

echo "## 3. Land handover pack (all incident threads)"
rm -rf "${VDS_PATH}.tmp"
cp -a "$PACK_SRC" "${VDS_PATH}.tmp"
( cd "${VDS_PATH}.tmp" && sha256sum -c MANIFEST.sha256 )
# mv into an existing directory nests the tmp dir inside it. Move the old pack aside first.
if [[ -e "$VDS_PATH" ]]; then
  rm -rf "${VDS_PATH}.prev"
  mv "$VDS_PATH" "${VDS_PATH}.prev"
fi
mv "${VDS_PATH}.tmp" "$VDS_PATH"
rm -rf "${VDS_PATH}.prev"
echo "handover pack: OK at ${VDS_PATH}"
echo

echo "## 4. Proton mirror (if rclone configured)"
proton_state="skip (rclone not installed)"
probe_fail=0
jev_state="not run"
if command -v rclone >/dev/null; then
  proton_log=$(mktemp)
  if rclone copy "$VDS_PATH" "zyn-vault:desk/cursor-incidents-20261001" --checksum >"$proton_log" 2>&1; then
    proton_state="mirrored"
  else
    proton_state="FAIL"
  fi
  tail -5 "$proton_log" || true
  echo "proton: ${proton_state}"
else
  echo "proton: rclone not installed — skip"
fi
echo

echo "## 5. Kelvin nginx apply (scoped — NOT nica.futbol, NOT jev, NOT silver_bot)"
bash "$REPO/ops/vds/kelvin-domains/apply_on_vds.sh"
echo

echo "## 6. Kelvin nginx live grep"
nginx -T 2>/dev/null | grep -iE 'kelvin|kelinsongs' | head -30 || true
echo

echo "## 7. Origin titles (from localhost)"
for d in nica.futbol kel.dog kelvinjimenez.com kelinsongs.com kelvinjimenez.net kelinjimenez.com jevsdev.com; do
  body=$(mktemp)
  http=$(curl -sS --max-time 20 -o "$body" -w '%{http_code}' -H "Host: $d" http://127.0.0.1/ 2>/dev/null || echo "000")
  title=$(grep -o '<title>[^<]*' "$body" | head -1 || true)
  if [[ "$http" != 200 || -z "$title" ]]; then
    title="FAIL http=${http} ${title}"
    probe_fail=1
  fi
  printf '%-22s %s\n' "$d" "$title"
done
echo

echo "## 8. JEV /health probe (Typesafe — read-only, no nginx change)"
jev_body=$(mktemp)
jev_http=$(curl -sS --max-time 20 -o "$jev_body" -w '%{http_code}' -H "Host: jevsdev.com" http://127.0.0.1/health 2>/dev/null || echo "000")
jev_health=$(head -c 400 "$jev_body" 2>/dev/null || echo "FAIL")
echo "$jev_health"
if [[ "$jev_http" == 200 ]] && printf '%s' "$jev_health" | python3 -c 'import json,sys
try:
    data=json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if data.get("ok") is True else 1)'; then
  jev_state="OK"
  echo "jev: OK (JSON health true)"
else
  jev_state="DRIFT http=${jev_http}"
  probe_fail=1
  echo "jev: DRIFT — /health not ok:true (needs surgical nginx restore; Hermes/silver_bot untouched)"
fi
echo

echo "## 9. Thread status written"
cat > "$THREAD_STATUS" <<EOF
# Thread handover status — VDS — $(date -u +%Y-%m-%dT%H:%M:%SZ)

| Thread | VDS state |
|--------|-----------|
| Handover pack | landed ${VDS_PATH} |
| sha256 | verified |
| Kelvin nginx | apply_on_vds.sh executed |
| Disk | see PROVE file section 2 |
| Hermes / silver_bot | NOT touched |
| JEV /health | ${jev_state} |
| Proton mirror | ${proton_state} |
| Origin probes | $([[ "$probe_fail" -eq 0 ]] && echo pass || echo FAIL) |
| Prove | ${PROVE} |
| Result | $([[ "$probe_fail" -eq 0 && "$proton_state" != FAIL ]] && echo DONE || echo PARTIAL) |

Repo commit at land: $(cd "$REPO" && git rev-parse --short HEAD)
EOF
cat "$THREAD_STATUS"
echo

echo "prove: ${PROVE}"
echo "thread_status: ${THREAD_STATUS}"
if [[ "$probe_fail" -eq 0 && "$proton_state" != FAIL ]]; then
  echo "DONE"
else
  echo "PARTIAL"
  exit 1
fi
