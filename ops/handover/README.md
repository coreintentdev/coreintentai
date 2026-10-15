# Handover packs (VDS + Proton)

## cursor-incidents-20261001

Incidents, refund draft, maps — Cursor Cloud session bc-5c23d672.

### VDS — all threads (preferred when Cloud SSH blocked)

Run **on the VDS as root** (noVNC terminal or Mac SSH):

```bash
git clone https://github.com/coreintentdev/coreintentai.git /tmp/coreintentai-handover
cd /tmp/coreintentai-handover && git checkout main && git pull
bash ops/handover/RUN-ALL-ON-VDS.sh
```

Prove: `/root/zynthio/desk/PROVE-CURSOR-HANDOVER-VDS-YYYYMMDD.md`

**Respects:** never touches `/root/silver_bot/` (Hermes). JEV probed read-only.

### Mac — remote land + Kelvin apply

```bash
cd ~/coreintentai && git pull origin main
bash ops/handover/RUN-ALL-MAC.sh
```

Land only (no Kelvin apply): `bash ops/handover/cursor-incidents-20261001/LAND-VDS-PROTON.sh`

VDS target: `100.121.107.112` (mesh). Origin: `5.189.143.170`.

Refund draft: `ops/handover/cursor-incidents-20261001/CURSOR-REFUND-REQUEST-DRAFT-20261001.md`
