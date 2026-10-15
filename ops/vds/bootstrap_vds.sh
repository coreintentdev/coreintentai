#!/usr/bin/env bash
# Cloud Agent boot: mesh join + SSH key install + connectivity probe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${ROOT}/bootstrap_mesh.sh" || true
bash "${ROOT}/bootstrap_ssh.sh" || true

if "${ROOT}/vds.sh" status >/dev/null 2>&1; then
  echo "VDS bootstrap complete — agents can use: ops/vds/vds.sh"
else
  echo "VDS bootstrap incomplete — add secrets in Cursor environment dashboard (never paste keys in chat)."
fi

# Probes after this boot only. VDS_AUTOPILOT=1 so autopilot does not call this script back.
# VDS_BOOTSTRAPPED=1 so it does not run mesh/ssh a second time (that pkill's tailscaled).
if [[ "${VDS_AUTOPILOT:-}" != 1 ]]; then
  VDS_AUTOPILOT=1 VDS_BOOTSTRAPPED=1 "${ROOT}/vds.sh" autopilot >/dev/null 2>&1 || true
fi
