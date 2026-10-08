#!/usr/bin/env bash
# Shared helpers for ops/vds — sourced, not executed.
set -euo pipefail

VDS_KEY_PATH="${HOME}/.ssh/zynthio_dc"
VDS_MESH_HOST="${ZYNTHIO_VDS_HOST:-100.121.107.112}"
VDS_ORIGIN_HOST="${ZYNTHIO_VDS_ORIGIN:-5.189.143.170}"
VDS_USER="${ZYNTHIO_VDS_USER:-root}"

vds_has_ssh_key() {
  [[ -f "$VDS_KEY_PATH" && -s "$VDS_KEY_PATH" ]]
}

vds_ssh_key_valid() {
  vds_has_ssh_key || return 1
  [[ "$(wc -c < "$VDS_KEY_PATH")" -ge 200 ]] || return 1
  ssh-keygen -y -f "$VDS_KEY_PATH" >/dev/null 2>&1
}

vds_mesh_key_valid() {
  local k="${HEADSCALE_PREAUTH_KEY:-${TAILSCALE_AUTHKEY:-}}"
  [[ -n "$k" && "${#k}" -ge 32 ]]
}

vds_mesh_reachable() {
  ping -c1 -W2 "$VDS_MESH_HOST" >/dev/null 2>&1
}

vds_origin_reachable() {
  ping -c1 -W2 "$VDS_ORIGIN_HOST" >/dev/null 2>&1
}

vds_origin_ssh_open() {
  timeout 3 bash -c "echo >/dev/tcp/${VDS_ORIGIN_HOST}/22" 2>/dev/null
}

# Prefer mesh; fall back to public origin when mesh down but port 22 answers.
vds_resolve_ssh_host() {
  if vds_mesh_reachable; then
    echo "$VDS_MESH_HOST"
    return 0
  fi
  if vds_origin_ssh_open; then
    echo "$VDS_ORIGIN_HOST"
    return 0
  fi
  echo "$VDS_MESH_HOST"
  return 1
}

vds_ensure_known_hosts() {
  local host
  for host in "$VDS_MESH_HOST" "$VDS_ORIGIN_HOST"; do
    ssh-keyscan -H "$host" >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true
  done
}

vds_run_ssh() {
  local host
  host="$(vds_resolve_ssh_host)" || {
    echo "BLOCKED: no SSH route (mesh down, origin :22 closed)"
    return 2
  }
  ssh -i "$VDS_KEY_PATH" -o BatchMode=yes -o ConnectTimeout=20 \
    "${VDS_USER}@${host}" "$@"
}
