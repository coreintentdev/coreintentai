#!/usr/bin/env bash
# Install tailscale client if missing (snapshot may lag Dockerfile).
set -euo pipefail

if command -v tailscale >/dev/null 2>&1 && command -v tailscaled >/dev/null 2>&1; then
  exit 0
fi

echo "tailscale missing — installing..."
if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  codename="${VERSION_CODENAME:-noble}"
else
  codename=noble
fi

curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/${codename}.noarmor.gpg" \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/${codename}.tailscale-keyring.list" \
  | sudo tee /etc/apt/sources.list.d/tailscale.list >/dev/null
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tailscale
echo "tailscale installed: $(tailscale version 2>/dev/null | head -1)"
