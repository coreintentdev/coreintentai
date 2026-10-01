# INC-20260930-ACTION-KELVIN-DEPLOY-PACKAGE

**Filed:** 2026-09-30 UTC  
**Action taken:** Cursor Cloud agent committed deploy artifacts (could not SSH)  

## What was done (git — not yet on VDS)

Branch: `cursorvds-kelvin-deploy-238d` on `coreintentdev/coreintentai`

| Path | Purpose |
|------|---------|
| `.cursor/environment.json` | Cloud env: run `bootstrap_ssh.sh` on start |
| `ops/vds/bootstrap_ssh.sh` | Install VDS key from `ZYNTHIO_DC_SSH_KEY` secret |
| `ops/vds/kelvin-domains/apply_on_vds.sh` | One-shot nginx + sites on VDS |
| `ops/vds/kelvin-domains/nginx/kelvin-domains.conf` | vhosts for Kelvin Jiménez song domains |
| `ops/vds/kelvin-domains/sites/*` | HTML (Kelvin Jiménez — not team) |
| `ops/vds/kelvin-domains/PROVE.sh` | Origin title check |

## One command to finish (Mac or Ruby SSH)

```bash
git clone / pull coreintentai branch cursorvds-kelvin-deploy-238d
cd coreintentai/ops/vds/kelvin-domains
scp -r . root@100.121.107.112:/root/kelvin-domains-deploy/
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 'bash /root/kelvin-domains-deploy/apply_on_vds.sh'
```

Or after merge to main on VDS if repo already cloned there.

## Still requires

1. Merge PR + run `apply_on_vds.sh` on VDS **once**
2. Add `ZYNTHIO_DC_SSH_KEY` to Cursor Cloud dashboard for future agents

336
