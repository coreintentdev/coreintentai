# HANDOVER THREAD — Cursor harm / operator record — 2026-10-01

**Operator:** Corey McIvor (@coreintentdev / corey@coreyai.ai)  
**Cloud run:** bc-5c23d672-ea3e-4ec1-97f9-dc64ffa5238d  
**Repo touched:** coreintentdev/coreintentai (PR #30 merged, PR #31 open)  
**VDS:** zynthio-vds-7372 · 100.121.107.112 · 5.189.143.170  

---

## Operator thesis (on record — not agent paraphrase)

1. **VDS + Mac SSH + Tailscale work.** Cursor Cloud does not.
2. **Cursor agents fail; operator pays** credits + fix-up time (INC-20261001-CURSOR-BILLING-ASYMMETRY).
3. **"AI makes mistakes" + Captain Obvious disclaimers** function as **de facto legal defense** for Cursor — logged "user was informed" while billing stands (operator: *"captain obvious appear as legal defence for cursor!"*).
4. **Refund discouragement is vendor protection**, not neutral advice (operator: *"evil"* — on record, not dismissed).
5. **Retention risk:** hiding behind disclaimers instead of responsibility will cost Cursor long-term customers (operator statement 2026-10-01).
6. **Groundhog day ~10 months:** daily new key requests, non-deployment, confusion (INC-20260930-CURSOR-GROUNDHOG-DAY-KEYS-CREDIT-WASTE).
7. **Unauthorized config:** kelvinjimenez.net in nginx without registration/instruction (INC-20261001-KELVIN-NET-UNAUTHORIZED-DOMAIN-ALIAS).
8. **Rollouts blocked** on Pro+ — Teams/Ent only (INC-20261001-CURSOR-ROLLOUTS-ACCOUNT-BLOCK — operator lane, on VDS+Proton).

**Agent record:** Failure is **Cursor/product**, not operator.

**Operator statement (2026-10-01):** *"is the ongoing emotional drm labelling of me the happy user as frustrated refundable or you get away with abuse too?"*

**Record:** Leaked agent planning text assigned *frustrated* while operator raised billing, accountability, and retention facts. Emotional labeling in support/leak logs can deflect refunds and responsibility — same class as INC-20260930-CURSOR-AGENT-REASONING-LEAK Session G (appended).

---

## What Cursor Cloud did (this thread)

| Action | Result |
|--------|--------|
| PR #30 | Bootstrap + Kelvin package merged — **bad .net aliases included** |
| PR #31 | Fix: remove unauthorized domains from git |
| HTTP probes | JEV live; Kelvin partial/wrong lane |
| Incidents | 10+ files in `incidents/` |
| VDS deploy | **NOT executed** — invalid Cloud secrets |
| Bot census / packs | **NOT in this repo** — Mac/VDS/Ruby lane |

---

## What works (proved)

- JEV `jevsdev.com/health` — live
- nica.futbol, kel.dog, yougetacut.com, noerus.net — origin OK
- Mac: `ssh -i ~/.ssh/zynthio_dc root@100.121.107.112`

---

## What is broken / open

- Kelvin: `.net` + typos duplicate `.com`; team content on song domains
- Cloud: no VDS hands without dashboard PEM paste
- Reasoning leak in Cursor UI
- Disk capacity: unverified from Cloud — need Mac `df`
- 45-bot census: operator lane — pack landing separate

---

## Git

- main: `1ac69ec` (PR #30)
- PR #31: https://github.com/coreintentdev/coreintentai/pull/31 — drop `.net` from nginx git

---

## Files in this pack

```
HANDOVER-THREAD-20261001.md          ← this file
HANDOVER-FULL-20260930.md
HANDOVER-CURSOR-SESSION-20260930.md
INCIDENT-REPORT-ALL-20260930.md
PLAN-METER-SAFE-20261001.md
ZYNTHIO-MAPS-20260930.md
incidents_20260930_bundle.json
PROVE-VDS-CAPACITY-CHECK-20261001.log
vds-exposure-probe-20260930.log
incidents/*.md + *.json
MANIFEST.sha256
LAND-VDS-PROTON.sh                   ← run from Mac
```

---

## Land on VDS + Proton (Mac — one shot)

```bash
PACK=handover-pack-20261001   # copy from Cursor artifacts or git export
VDS=root@100.121.107.112
KEY=~/.ssh/zynthio_dc
VDS_PATH=/root/zynthio/desk/handover/cursor-incidents-20261001
PROTON_PATH=/root/proton/desk/cursor-incidents-20261001   # or zyn-vault: path

scp -i "$KEY" -r "$PACK" "$VDS:$VDS_PATH"
ssh -i "$KEY" "$VDS" "cd $VDS_PATH && sha256sum -c MANIFEST.sha256"

# Proton mirror (adjust remote to your rclone config)
rclone copy "$PACK" zyn-vault:desk/cursor-incidents-20261001 --checksum
rclone md5sum zyn-vault:desk/cursor-incidents-20261001
```

Save prove: `~/Desktop/desk/PROVE-CURSOR-HANDOVER-LAND-$(date +%Y%m%d).md`

---

## Meter-safe rule (operator)

**Cursor CloudAgent: stand down** for VDS/bots. Mac SSH + Qwen 54wc + Ruby/Grok for ops.

---

## Support / billing (operator choice)

If escalating Cursor: attach this pack + bc-5c23d672 URL + INC-20261001-CURSOR-BILLING-ASYMMETRY-OPERATOR-PAYS.  
Not agent advice to skip — operator decision.

336
