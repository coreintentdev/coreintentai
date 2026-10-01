# Meter-safe plan — 2026-10-01 (no spin)

**Operator doctrine:** Bot census + one-job runs + full pack land on VDS+Proton with checksum prove. Not another agent report loop.

**This file:** Lane map + 48h priorities. Cursor Cloud (coreintentai) stands down on VDS deploy and bot census — those paths live on Mac/VDS/Ruby lane, not this repo.

---

## Meters (operator stated)

| Lane | Status | Rule until refresh |
|------|--------|-------------------|
| Devin Pro | Out (~3–4d) | **Stand down** |
| Cursor Pro+ Models | Live (~19%; Cloud often blocked) | gh + local/box only; **no CloudAgent VDS thrash** |
| Cursor Other Models | 100% | **Cold** |
| Qwen 54wc | Chat 200 on VDS+Mac | Real jobs only — no idle probes |
| Rollouts | **Blocked** (Teams/Ent; Pro+ = Automations only) | **Skip retries** — INC on VDS+Proton |
| Grok Bot | ~75–81%; ~5d refresh | Deliverables only |

---

## Root causes already filed (do not re-litigate)

| INC | Fact |
|-----|------|
| INC-20261001-CURSOR-ROLLOUTS-ACCOUNT-BLOCK | Rollouts = plan gate; Try again useless |
| INC-20261001-CURSOR-BILLING-ASYMMETRY-OPERATOR-PAYS | Agent fails; operator pays fix |
| INC-20261001-KELVIN-NET-UNAUTHORIZED-DOMAIN-ALIAS | .net nginx without instruction |
| INC-20260930-CURSOR-GROUNDHOG-DAY-KEYS-CREDIT-WASTE | Daily key loop |

---

## Fleet fitness (operator lane — not in coreintentai git)

- **45 bots:** OK 1 · PARTIAL 33 · UNSTRUCTURED 8 · EMPTY 3
- Only Export Scrub has real healthcheck; 40 silent fails = missing Healthcheck on PARTIALs
- EMPTY: Grok Bot + two "New Agent" shells
- Census run-proof: **Y 24 · N 18 · SKIP 3**
- Table: `sirbotforgotalot/STATUS_TABLE_20261001T0551CST.md` (Mac/VDS pack)
- Pack: `vds-landing/sirbotforgotalot-fitness-20261001/` → land VDS+Proton + checksum

**Next after land:** stamp Healthcheck on 33 PARTIAL bots (stops silent-fail count).

---

## 48h deliverables (prove = checksum or one-job log, not chat)

| # | Deliverable | Lane | Prove path |
|---|-------------|------|------------|
| 1 | Bot census pack land | VDS/Ruby/Mac | `sha256sum` on VDS + Proton mirror path |
| 2 | Groundhog + usage/value INC on desk | Any lane with SSH | `~/Desktop/desk/incidents/` |
| 3 | Kelvin WA send | VDS/Ruby | message id / timestamp log |
| 4 | Baileys QR on VDS | VDS SSH | QR session up, Mac-free |
| 5 | Suno masters → Proton only | Mac/rclone | Proton path + size; **no VDS dump** |
| 6 | Kelvin nginx: drop `.net` aliases | Mac SSH | `nginx -T \| grep kelvinjimenez` + PR #31 merge |
| 7 | 18× N bots one-job exec | Meter-safe batches | `CENSUS_EVERY_BOT_RUN_PROOF` updated Y |

**18 N bots (need real one-job, not chat):** Wikinme, XtractorFan, ChIllegal, Log-to-Blog-Rhyme, AcccCase, Gimmie, GpuWeKnew, Export Scrub, NewsWeGot, Mlllm, Orchestra, ExaAxe, Aimakesmistakes, IllMakeThePics, LatinCoda, YinYan, AiKnowYourClient, Proof Desk.

---

## Do NOT burn meter on

- Rollouts retries
- Cursor CloudAgent VDS deploy / paste-keys bootstrap
- Devin
- Hermes SMS idle
- Redrawing ORICO/fleet maps
- Contradictory disk % without `df`
- New nginx domains without operator name + registration prove

---

## Lane assignment (who does what)

| Work | Lane |
|------|------|
| Bot census, fitness pack, 18× one-job runs | **Mac / VDS / Ruby / Grok** (sirbotforgotalot, botswegot) |
| VDS nginx, Baileys, WA, Suno→Proton | **Mac SSH** |
| Qwen 54wc real jobs | VDS+Mac API |
| coreintentai library/tests | Cursor local/gh if needed |
| Cursor CloudAgent | **STAND DOWN** for VDS/bots until hands work |

---

## If Grok hits 100% early

- **Keep alive:** VDS/Ruby/SSH + Qwen 54wc
- **Mansion bots:** free/local where already set
- **Cursor:** cold (Other already 100%; Pro+ only for gh merge if needed)

---

## coreintentai git (this repo — one item)

| Action | Status |
|--------|--------|
| PR #31 — remove kelvinjimenez.net from nginx git | Open — merge when ready |
| PR #30 | Merged — do not re-bootstrap Cloud for VDS |

---

## Prove format (when packs land)

Operator/Ruby pastes — not "working on it":

```text
VDS: sha256 <hash>  /root/.../sirbotforgotalot-fitness-20261001/
Proton: sha256 <hash>  (mirror path)
Land time: UTC
```

336 — plan only. Execution on VDS/Mac lane.
