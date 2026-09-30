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
