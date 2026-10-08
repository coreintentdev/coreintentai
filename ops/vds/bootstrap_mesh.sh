#!/usr/bin/env bash
# Join Zynthio Tailscale/Headscale mesh so Cloud Agent can reach VDS (100.121.107.112).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/lib.sh"

STATE_DIR="${HOME}/.zynthio-vds"
TS_SOCKET="${STATE_DIR}/tailscaled.sock"
mkdir -p "$STATE_DIR"

bash "${ROOT}/ensure_tailscale.sh"

start_tailscaled() {
  if sudo tailscale status --socket="$TS_SOCKET" >/dev/null 2>&1; then
    return 0
  fi
  # Kill stale socket holder if any
  if [[ -S "$TS_SOCKET" ]]; then
    sudo pkill -f "tailscaled.*${TS_SOCKET}" 2>/dev/null || true
    sleep 0.5
  fi
  sudo tailscaled --state="${STATE_DIR}/tailscaled.state" --socket="$TS_SOCKET" >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    sudo tailscale --socket="$TS_SOCKET" status >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  echo "tailscaled failed to start"
  return 1
}

join_mesh() {
  if ! vds_mesh_key_valid; then
    echo "mesh key placeholder — skip join (set real HEADSCALE_PREAUTH_KEY in dashboard)"
    return 1
  fi

  local login_server="${HEADSCALE_LOGIN_SERVER:-https://headscale.kamals.pro}"
  local args=(--login-server="$login_server")

  if [[ -n "${HEADSCALE_PREAUTH_KEY:-}" ]]; then
    if sudo tailscale --socket="$TS_SOCKET" up "${args[@]}" \
      --auth-key="$HEADSCALE_PREAUTH_KEY" --accept-routes --ssh=false --timeout=30s 2>&1; then
      echo "Headscale mesh joined via HEADSCALE_PREAUTH_KEY"
      return 0
    fi
    echo "Headscale join failed (expired or invalid preauth key)"
    return 1
  fi

  if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
    if sudo tailscale --socket="$TS_SOCKET" up \
      --auth-key="$TAILSCALE_AUTHKEY" --accept-routes --ssh=false --timeout=30s 2>&1; then
      echo "Tailscale mesh joined via TAILSCALE_AUTHKEY"
      return 0
    fi
    echo "Tailscale join failed"
    return 1
  fi

  echo "No mesh key — set HEADSCALE_PREAUTH_KEY in Cursor environment secrets."
  return 1
}

probe_vds_route() {
  if vds_mesh_reachable; then
    echo "VDS route OK: ${VDS_MESH_HOST} reachable on mesh"
    return 0
  fi
  echo "VDS route FAIL: ${VDS_MESH_HOST} not reachable (mesh not joined or key expired)"
  return 1
}

main() {
  start_tailscaled || exit 1
  if join_mesh; then
    probe_vds_route || true
  else
    if vds_origin_reachable; then
      echo "fallback: origin ${VDS_ORIGIN_HOST} reachable (HTTP probes + origin SSH if key valid)"
    fi
  fi
}

main "$@"
