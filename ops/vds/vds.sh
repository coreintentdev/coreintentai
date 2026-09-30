#!/usr/bin/env bash
# Single VDS entry point for Cloud Agents. Do not ask the operator to paste SSH keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_PATH="${HOME}/.ssh/zynthio_dc"
VDS_HOST="${ZYNTHIO_VDS_HOST:-100.121.107.112}"
VDS_USER="${ZYNTHIO_VDS_USER:-root}"
VDS_ORIGIN="${ZYNTHIO_VDS_ORIGIN:-5.189.143.170}"

usage() {
  cat <<'EOF'
Usage: ops/vds/vds.sh <command> [args]

Commands:
  status              Mesh + SSH readiness (exit 0 = hands available)
  ssh <remote-cmd>    Run command on VDS via SSH
  deploy kelvin       Apply Kelvin song domain nginx + HTML on VDS
  prove kelvin        Origin title check for Kelvin domains
  prove all           Origin title check (Kelvin + related)

Secrets (Cursor environment dashboard — one-time, never paste in chat):
  ZYNTHIO_DC_SSH_KEY          SSH private key (~/.ssh/zynthio_dc on Mac)
  HEADSCALE_PREAUTH_KEY       Headscale preauth key (+ HEADSCALE_LOGIN_SERVER)
  or TAILSCALE_AUTHKEY        Tailscale auth key
EOF
}

has_mesh_key() {
  [[ -n "${HEADSCALE_PREAUTH_KEY:-}" || -n "${TAILSCALE_AUTHKEY:-}" ]]
}

has_ssh_key() {
  [[ -f "$KEY_PATH" && -s "$KEY_PATH" ]]
}

mesh_reachable() {
  ping -c1 -W2 "$VDS_HOST" >/dev/null 2>&1
}

cmd_status() {
  local ok=0
  echo "=== VDS status ==="
  if has_mesh_key; then
    echo "mesh key: present"
  else
    echo "mesh key: MISSING (HEADSCALE_PREAUTH_KEY or TAILSCALE_AUTHKEY)"
    ok=1
  fi
  if has_ssh_key; then
    echo "ssh key:  present (${KEY_PATH})"
  else
    echo "ssh key:  MISSING (ZYNTHIO_DC_SSH_KEY)"
    ok=1
  fi
  if mesh_reachable; then
    echo "route:    ${VDS_HOST} reachable"
  else
    echo "route:    ${VDS_HOST} NOT reachable"
    ok=1
  fi
  if has_ssh_key && mesh_reachable; then
    if ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=12 \
      "${VDS_USER}@${VDS_HOST}" "echo ssh_ok" 2>/dev/null | grep -q ssh_ok; then
      echo "ssh:      OK"
    else
      echo "ssh:      FAIL (key or authorized_keys)"
      ok=1
    fi
  fi
  return "$ok"
}

cmd_ssh() {
  if ! has_ssh_key; then
    echo "BLOCKED: ZYNTHIO_DC_SSH_KEY not in environment. Add in Cursor dashboard — do not paste in chat."
    exit 2
  fi
  if ! mesh_reachable; then
    echo "BLOCKED: ${VDS_HOST} unreachable. Run bootstrap or add mesh key in Cursor dashboard."
    exit 2
  fi
  ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=30 \
    "${VDS_USER}@${VDS_HOST}" "$@"
}

cmd_deploy_kelvin() {
  echo "=== Deploy Kelvin domains on VDS ==="
  tar -C "${ROOT}/kelvin-domains" -cf - . | \
    cmd_ssh "mkdir -p /tmp/kelvin-domains && tar -xf - -C /tmp/kelvin-domains && bash /tmp/kelvin-domains/apply_on_vds.sh"
}

cmd_prove_kelvin() {
  ZYNTHIO_VDS_ORIGIN="$VDS_ORIGIN" bash "${ROOT}/kelvin-domains/PROVE.sh"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    status) cmd_status ;;
    ssh) cmd_ssh "$@" ;;
    deploy)
      case "${1:-}" in
        kelvin) cmd_deploy_kelvin ;;
        *) echo "Unknown deploy target: ${1:-}"; usage; exit 1 ;;
      esac
      ;;
    prove)
      case "${1:-}" in
        kelvin|all) cmd_prove_kelvin ;;
        *) echo "Unknown prove target: ${1:-}"; usage; exit 1 ;;
      esac
      ;;
    -h|--help|help|"") usage ;;
    *) echo "Unknown command: $cmd"; usage; exit 1 ;;
  esac
}

main "$@"
