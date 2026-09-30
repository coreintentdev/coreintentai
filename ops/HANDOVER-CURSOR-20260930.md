# HANDOVER — Cursor Session 20260930

**VDS lane:** `ops/vds/vds.sh` — not paste-keys, not guess-SSH.

```bash
ops/vds/vds.sh status
ops/vds/vds.sh deploy kelvin
ops/vds/vds.sh prove kelvin
```

**Secrets (dashboard once):** `ZYNTHIO_DC_SSH_KEY`, `HEADSCALE_PREAUTH_KEY` + `HEADSCALE_LOGIN_SERVER` (or `TAILSCALE_AUTHKEY`).

**Kelvin:** team = `nica.futbol` only. Song domains = `kelvinjimenez.com`, `kelinsongs.com` (deploy package in `ops/vds/kelvin-domains/`).

**PR:** #30 on branch `cursorvds-kelvin-deploy-238d`.
