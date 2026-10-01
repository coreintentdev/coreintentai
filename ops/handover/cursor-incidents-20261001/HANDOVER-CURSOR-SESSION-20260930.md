# HANDOVER — Cursor Cloud Session 20260930

**Operator:** Corey McIvor (@coreintentdev)  
**Repo:** coreintentdev/coreintentai  
**Branch:** cursorvds-kelvin-deploy-238d  
**PR:** https://github.com/coreintentdev/coreintentai/pull/30  
**Cloud agent bcId:** bc-5c23d672-ea3e-4ec1-97f9-dc64ffa5238d  
**Session date:** 2026-09-30 UTC  

---

## READ FIRST (canonical — do not redraw)

| Doc | Path |
|-----|------|
| Fleet / Proton / VDS map | `Desktop/zynthio-tools/ALL_NOTES/ORICO_MAP.md` (2026-08-08) |
| VPS correction | `Desktop/desk/INCIDENT_VPS_ABANDONED_20260822_CORRECTED.json` |
| Domain wiki (STALE Aug) | `zyn/18JUNE/domain-wiki-manifest.json` — 842 domains, mostly PARK |
| VDS manifest | `zyn/18JUNE/vds-source-manifest.json` |
| Deploy gap (STALE) | `zyn/18JUNE/context-pack/deployment-gap-report/all-domains.json` |

**Rule:** No fleet counts from stale JSON without live `nginx -T` + Porkbun API prove.

---

## VDS

| Item | Value |
|------|-------|
| Host | zynthio-vds-7372 |
| Tailscale | 100.121.107.112 |
| Public | 5.189.143.170 |
| SSH key (Mac) | ~/.ssh/zynthio_dc |
| **Cursor Cloud** | **NO SSH KEY** — cannot deploy from cloud until `ZYNTHIO_DC_SSH_KEY` in environment |

**Never touch:** `/root/silver_bot/`  
**No rm -rf** — use `/_TO_DELETE/` only  

**Disk:** Grok/Ruby claimed ~86%/25G free + guard script (Sep 30). Cloud agent wrongly said 99% earlier — **trust live `df` on VDS, not cloud guesses.**

---

## DONE (origin-proved 2026-09-30)

| Domain | Title / purpose |
|--------|-----------------|
| yougetacut.com | You Get A Cut nameplate (was youlittledev) |
| noerus.net | No E Rus nameplate |
| nica.futbol | **Real España SJDS — Kelvin Jiménez TEAM** (songs for team, NOT kelinsongs catalog) |
| kel.dog / kel.rip | Kel nameplate |
| jevsdev.com | JEV router + `/frame` Problem-to-Questions Engine |
| jevsdev.com/health | Jev API live, 11553 lyrics indexed |
| calibratedrouting.com | Calibrated Routing nameplate |

---

## NOT DONE (proved broken or pending)

| Item | State |
|------|-------|
| kelvinjimenez.com, kelinsongs.com, kelvinjimenez.net, kelinjimenez.com, kelin-songs.com | **youlittledev default** on VDS origin |
| Kelvin deploy fix | **In PR #30** — `ops/vds/kelvin-domains/apply_on_vds.sh` — **NOT RUN on VDS** |
| discoversjds.com | legacy on VDS; client Natalie; WP on discoversjds only |
| discoversanjuandelsur.com | missing deploy |
| Discover SJDS: all properties → songs on GPU | **NOT FINISHED — no prove** |
| Suno credit burn | claimed by Grok, **no before/after credits prove** |
| Fleet “built today” count | **UNKNOWN — no live audit run** |
| CANONICAL_DOMAINS_AND_SITES.json | **missing** from workspace |

---

## KELVIN — NAME AND DOMAIN RULES (operator corrected agents)

- Person: **Kelvin Jiménez** — NOT “Kelin”
- **nica.futbol** = football **team** (Real España) + team songs
- **kel.dog** = short Kel brand
- **kelvinjimenez.com / kelinsongs.com** = Kelvin **music/songs lane** — separate from team site
- Do NOT put kelinsongs catalog on nica.futbol

---

## JEV (VDS live)

- Frame UI: POST `/frame` returns domain-tagged questions
- Decide: POST `/decide` → TypeSafe Jev API
- Lyrics context: `/root/zynthio/desk/handover/jev_context_20260930` — 11553 rows (~30MB jsonl)
- jevdev.com → MostExclusiveDomains (parking) — NOT JEV app

---

## CURSOR CLOUD FIX (future agents)

1. Merge PR #30  
2. Dashboard → Cloud environment → secret **`ZYNTHIO_DC_SSH_KEY`**  
3. Rebuild snapshot (`.cursor/environment.json` + `ops/vds/bootstrap_ssh.sh` on branch)  
4. Optional: add `coreintentdev/zyn` as repositoryDependency  

---

## APPLY KELVIN DOMAINS (one SSH — Mac or Ruby)

```bash
git fetch origin cursorvds-kelvin-deploy-238d
cd coreintentai/ops/vds/kelvin-domains
scp -r . root@100.121.107.112:/root/kelvin-domains-deploy/
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 'bash /root/kelvin-domains-deploy/apply_on_vds.sh' | tee ~/Desktop/desk/PROVE-KELVIN-DOMAINS-$(date +%Y%m%d).md
```

---

## INCIDENTS FILED (this session)

| ID | Path |
|----|------|
| Reasoning leak / labeling in UI | `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-AGENT-REASONING-LEAK.md` |
| Contradictory ops (99% vs 86%) | `INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json` |
| No VDS access | `INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS.md` |
| Kelvin partial done | `INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE.md` |
| Deploy package action | `INC-20260930-ACTION-KELVIN-DEPLOY-PACKAGE.md` |
| Grok bot client (operator desk) | `INC-20260930-GROKBOT-CLIENT-ONGOING.md` (Mac) |

Copy artifacts → `~/Desktop/desk/incidents/`

---

## AGENT FAILURES THIS SESSION (do not repeat)

1. Assigned operator emotional states in visible/leaked reasoning (“frustrated”, “hurt”) — operator rejected  
2. “If you want…” soft closes — operator rejected as BS  
3. Said 99% disk without live `df`  
4. Suggested offload WhatsApp/Tuta to Proton — operator rejected (mirror-in to `/root/proton` is part of problem)  
5. Used stale manifests as “today” fleet status  
6. Chat + paste SSH instead of git deploy or SSH lane with hands  
7. Called person “Kelin” — name is **Kelvin**  

---

## HARD RULES FOR NEXT CURSOR AGENT

- Read ORICO_MAP + latest PROVE-* before any claim  
- No operator mood labels — ever  
- No fleet numbers without live prove  
- If no VDS SSH: commit deploy artifacts OR say **wrong lane — use Mac/Ruby**  
- If disk > 85%: no parity sync, no ollama pull, no rclone to `/root`  
- BUY STOP on new domains unless operator explicitly orders  
- Do NOT lookup norues, drsyntax.nz, yougetacut.nz unless asked  

---

## LIVE FLEET AUDIT (not run — next agent or Ruby)

```bash
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 '
  df -h /
  nginx -T 2>/dev/null | grep server_name | sort -u | wc -l
  suno-stack credits 2>/dev/null || true
'
bash ops/vds/kelvin-domains/PROVE.sh   # after deploy
```

---

## WHAT THIS SESSION ACTUALLY SHIPPED

- Git: PR #30 (VDS SSH bootstrap + Kelvin domain deploy package)  
- Tests: 365 passed, typecheck clean  
- HTTP probes + incident docs  
- **Zero** nginx changes applied on VDS from Cloud  

336 — VDS is boss. Prove or stop talking.
