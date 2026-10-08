#!/usr/bin/env bash
# Cloud Agent: wire VDS SSH when ZYNTHIO_DC_SSH_KEY secret is set in Cursor environment.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/lib.sh"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ -z "${ZYNTHIO_DC_SSH_KEY:-}" ]]; then
  echo "ZYNTHIO_DC_SSH_KEY not set — add once in Cursor environment secrets (do not paste in chat)."
  exit 0
fi

printf '%s\n' "$ZYNTHIO_DC_SSH_KEY" > "$VDS_KEY_PATH"
chmod 600 "$VDS_KEY_PATH"
vds_ensure_known_hosts

if ! vds_ssh_key_valid; then
  echo "ZYNTHIO_DC_SSH_KEY is placeholder ($(wc -c < "$VDS_KEY_PATH") bytes) — replace with real Mac ~/.ssh/zynthio_dc in dashboard"
  exit 0
fi

echo "VDS SSH key installed for ${VDS_USER}@${VDS_MESH_HOST}"

if vds_run_ssh "df -h / | tail -1" 2>/dev/null; then
  echo "VDS SSH OK via $(vds_resolve_ssh_host)"
else
  echo "VDS SSH probe failed (check key authorized on VDS or mesh/origin route)"
fi
