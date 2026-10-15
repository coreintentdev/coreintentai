#!/usr/bin/env bash
# Single VDS entry point for Cloud Agents. Do not ask the operator to paste SSH keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/lib.sh"

REPORT_DIR="${ROOT}/reports"

usage() {
  cat <<'EOF'
Usage: ops/vds/vds.sh <command> [args]

Commands:
  autopilot           Bootstrap + prove + deploy-if-ready (no prompts)
  status              Mesh + SSH readiness (exit 0 = hands available)
  ssh <remote-cmd>    Run command on VDS via SSH (mesh, else origin)
  deploy kelvin       Apply Kelvin song domain nginx + HTML on VDS
  prove kelvin        Origin title check for Kelvin domains (flags drift)

Secrets (Cursor environment dashboard — one-time, never paste in chat):
  ZYNTHIO_DC_SSH_KEY          SSH private key (~/.ssh/zynthio_dc on Mac)
  HEADSCALE_PREAUTH_KEY       Headscale preauth key (login server defaults to https://headscale.kamals.pro)
  or TAILSCALE_AUTHKEY        Tailscale auth key
EOF
}

cmd_status() {
  local ok=0
  echo "=== VDS status ==="
  echo "mesh:     headscale.kamals.pro (zynthio)"
  if [[ -n "${HEADSCALE_PREAUTH_KEY:-}${TAILSCALE_AUTHKEY:-}" ]]; then
    if vds_mesh_key_valid; then
      echo "mesh key: present"
    else
      echo "mesh key: PLACEHOLDER (${#HEADSCALE_PREAUTH_KEY}${TAILSCALE_AUTHKEY:+/${#TAILSCALE_AUTHKEY}} bytes — replace in Cursor dashboard)"
      ok=1
    fi
  else
    echo "mesh key: MISSING (HEADSCALE_PREAUTH_KEY)"
    ok=1
  fi
  if vds_has_ssh_key; then
    if vds_ssh_key_valid; then
      echo "ssh key:  present (${VDS_KEY_PATH})"
    else
      echo "ssh key:  PLACEHOLDER ($(wc -c < "$VDS_KEY_PATH") bytes — libcrypto will fail)"
      ok=1
    fi
  else
    echo "ssh key:  MISSING (ZYNTHIO_DC_SSH_KEY)"
    ok=1
  fi
  if vds_mesh_reachable; then
    echo "route:    ${VDS_MESH_HOST} reachable (mesh)"
  elif vds_origin_ssh_open; then
    echo "route:    ${VDS_MESH_HOST} down; origin ${VDS_ORIGIN_HOST}:22 open (SSH fallback)"
  elif vds_origin_reachable; then
    echo "route:    origin ${VDS_ORIGIN_HOST} ping OK; :22 closed"
    ok=1
  else
    echo "route:    ${VDS_MESH_HOST} NOT reachable"
    ok=1
  fi
  if vds_ssh_key_valid; then
    if vds_run_ssh "echo ssh_ok" 2>/dev/null | grep -q ssh_ok; then
      echo "ssh:      OK via $(vds_resolve_ssh_host)"
    else
      echo "ssh:      FAIL (key or authorized_keys)"
      ok=1
    fi
  fi
  return "$ok"
}

cmd_ssh() {
  if ! vds_has_ssh_key; then
    echo "BLOCKED: ZYNTHIO_DC_SSH_KEY not in environment. Add in Cursor dashboard — do not paste in chat."
    exit 2
  fi
  if ! vds_ssh_key_valid; then
    echo "BLOCKED: ZYNTHIO_DC_SSH_KEY is placeholder ($(wc -c < "$VDS_KEY_PATH") bytes)."
    exit 2
  fi
  vds_run_ssh "$@"
}

cmd_deploy_kelvin() {
  echo "=== Deploy Kelvin domains on VDS ==="
  tar -C "${ROOT}/kelvin-domains" -cf - . | \
    cmd_ssh "mkdir -p /tmp/kelvin-domains && tar -xf - -C /tmp/kelvin-domains && bash /tmp/kelvin-domains/apply_on_vds.sh"
}

cmd_prove_kelvin() {
  ZYNTHIO_VDS_ORIGIN="$VDS_ORIGIN_HOST" bash "${ROOT}/kelvin-domains/PROVE.sh"
}

cmd_autopilot() {
  local ts report drift=0 deploy_ok=0
  # Mark this process so bootstrap_vds.sh cannot re-enter autopilot.
  export VDS_AUTOPILOT=1
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$REPORT_DIR"
  report="${REPORT_DIR}/autopilot-${ts}.log"

  # Redirect keeps this brace in the current shell so drift=1 is visible after tee.
  # A pipe would run the brace in a subshell and the parent drift would stay 0.
  {
    echo "# VDS autopilot ${ts}"
    echo
    if [[ "${VDS_BOOTSTRAPPED:-}" != 1 ]]; then
      bash "${ROOT}/bootstrap_mesh.sh" 2>&1 || true
      bash "${ROOT}/bootstrap_ssh.sh" 2>&1 || true
    fi
    echo
    cmd_status 2>&1 || true
    echo
    echo "=== prove kelvin ==="
    if cmd_prove_kelvin 2>&1; then
      echo "prove: OK (no drift)"
    else
      echo "prove: DRIFT detected"
      drift=1
    fi
    echo
    if vds_ssh_key_valid && vds_run_ssh "echo ssh_ok" 2>/dev/null | grep -q ssh_ok; then
      if [[ "$drift" -eq 1 ]]; then
        echo "=== auto-deploy kelvin (drift fix) ==="
        if cmd_deploy_kelvin 2>&1; then
          echo "deploy: OK"
          deploy_ok=1
          echo
          echo "=== post-deploy prove ==="
          cmd_prove_kelvin 2>&1 || true
        else
          echo "deploy: FAIL"
        fi
      else
        echo "deploy: skip (no drift)"
        deploy_ok=1
      fi
    else
      echo "deploy: skip (SSH not ready — fix dashboard secrets; HTTP prove still ran)"
    fi
  } > >(tee "$report") 2>&1

  echo "report: ${report}"
  ln -sf "$(basename "$report")" "${REPORT_DIR}/latest.log"

  if vds_ssh_key_valid && vds_run_ssh "echo ssh_ok" 2>/dev/null | grep -q ssh_ok; then
    return 0
  fi
  # SSH blocked but we still ran probes — exit 0 if no drift, else 1
  return "$drift"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    autopilot) cmd_autopilot ;;
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
