# HANDOVER — Cursor Session 20260930

**VDS lane:** `ops/vds/vds.sh` — not paste-keys, not guess-SSH.

```bash
ops/vds/vds.sh status
ops/vds/vds.sh deploy kelvin
ops/vds/vds.sh prove kelvin
```

**Secrets (dashboard once):** `ZYNTHIO_DC_SSH_KEY`, `HEADSCALE_PREAUTH_KEY` (mesh = `zynthio` @ `headscale.kamals.pro`, login server defaulted in bootstrap).

**Kelvin:** team = `nica.futbol` only. Song domains = `kelvinjimenez.com`, `kelinsongs.com` only. **Do not** nginx-alias `kelvinjimenez.net` or typo domains unless operator registers and instructs (see INC-20261001-KELVIN-NET-UNAUTHORIZED-DOMAIN-ALIAS).

**PR:** #30 on branch `cursorvds-kelvin-deploy-238d`.
