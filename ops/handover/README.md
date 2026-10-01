# Handover packs (VDS + Proton)

## cursor-incidents-20261001

Incidents, refund draft, maps — Cursor Cloud session bc-5c23d672.

### Mac — get files (Cloud artifacts are NOT on your desk automatically)

```bash
git clone https://github.com/coreintentdev/coreintentai.git
cd coreintentai
git fetch origin cursorfix-kelvin-net-alias-238d
git checkout cursorfix-kelvin-net-alias-238d
bash ops/handover/cursor-incidents-20261001/LAND-VDS-PROTON.sh
```

VDS target: `100.121.107.112` (not 100.64.x — that is a different Tailscale node).

Refund draft: `ops/handover/cursor-incidents-20261001/CURSOR-REFUND-REQUEST-DRAFT-20261001.md`
