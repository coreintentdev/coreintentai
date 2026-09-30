#!/usr/bin/env bash
# Join Zynthio Tailscale/Headscale mesh so Cloud Agent can reach VDS (100.121.107.112).
set -euo pipefail

STATE_DIR="${HOME}/.zynthio-vds"
TS_SOCKET="${STATE_DIR}/tailscaled.sock"
mkdir -p "$STATE_DIR"

start_tailscaled() {
  if sudo tailscale status --socket="$TS_SOCKET" >/dev/null 2>&1; then
    return 0
  fi
  sudo tailscaled --state="${STATE_DIR}/tailscaled.state" --socket="$TS_SOCKET" >/dev/null 2>&1 &
  for _ in $(seq 1 30); do
    sudo tailscale --socket="$TS_SOCKET" status >/dev/null 2>&1 && return 0
    sleep 0.2
  done
  echo "tailscaled failed to start"
  return 1
}

join_mesh() {
  # Zynthio mesh — same Headscale as Mac "zynthio @ headscale.kamals.pro"
  local login_server="${HEADSCALE_LOGIN_SERVER:-https://headscale.kamals.pro}"
  local args=(--login-server="$login_server")

  if [[ -n "${HEADSCALE_PREAUTH_KEY:-}" ]]; then
    sudo tailscale --socket="$TS_SOCKET" up "${args[@]}" --auth-key="$HEADSCALE_PREAUTH_KEY" --accept-routes --ssh=false
    echo "Headscale mesh joined via HEADSCALE_PREAUTH_KEY"
    return 0
  fi

  if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
    sudo tailscale --socket="$TS_SOCKET" up --auth-key="$TAILSCALE_AUTHKEY" --accept-routes --ssh=false
    echo "Tailscale mesh joined via TAILSCALE_AUTHKEY"
    return 0
  fi

  echo "No mesh key — set HEADSCALE_PREAUTH_KEY in Cursor environment secrets (login server defaults to https://headscale.kamals.pro)."
  return 1
}

probe_vds_route() {
  local host="${ZYNTHIO_VDS_HOST:-100.121.107.112}"
  if ping -c1 -W2 "$host" >/dev/null 2>&1; then
    echo "VDS route OK: ${host} reachable on mesh"
    return 0
  fi
  echo "VDS route FAIL: ${host} not reachable (mesh not joined or key expired)"
  return 1
}

main() {
  start_tailscaled || exit 1
  if join_mesh; then
    probe_vds_route || true
  fi
}

main "$@"
