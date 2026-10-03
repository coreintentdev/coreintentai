# FULL HANDOVER — Corey McIvor / Zynthio / VDS / Cursor

**Date:** 2026-09-30 UTC  
**Session agent:** bc-5c23d672 (Cursor Cloud on coreintentdev/coreintentai)  
**Operator verdict:** VDS + Tailscale work from Mac. **Cursor Cloud is the broken lane** — not the stack.

---

## 1. What the operator said (facts)

- SSH to VDS **works** from Mac (`~/.ssh/zynthio_dc`, `root@100.121.107.112`).
- Tailscale IP **works** from Mac (`zynthio @ headscale.kamals.pro`).
- **Cursor Cloud** cannot do VDS work without pasting keys into the Cursor dashboard — operator rejected doing that 10 months in.
- Placeholder secrets were entered in dashboard (not real keys) — Cloud pod got 12-byte garbage, SSH failed `error in libcrypto`.
- **This is a Cursor product gap**, not operator error and not VDS failure.

---

## 2. VDS identity (canonical)

| | |
|---|---|
| Host | zynthio-vds-7372 |
| Tailscale | **100.121.107.112** |
| Public origin | **5.189.143.170** |
| SSH (Mac) | `ssh -i ~/.ssh/zynthio_dc root@100.121.107.112` |
| Mesh | Headscale `https://headscale.kamals.pro`, namespace `zynthio` |

**Hard rules on VDS:**
- **NEVER** touch `/root/silver_bot/`
- **NEVER** `rm -rf` — use `/_TO_DELETE/` only
- VDS is boss for nginx, deploy, disk, Suno prove

---

## 3. Lane map — who does what

| Lane | VDS hands? | Use for |
|------|------------|---------|
| **Mac Cursor + SSH** | YES | nginx, Kelvin deploy, disk, `nginx -T`, Suno credits |
| **Ruby / Grok on Mac** | YES (if SSH configured) | Same as Mac |
| **Cursor Cloud Agent** | NO (unless real keys pasted in dashboard) | Library code, tests, HTTP probes only |
| **JEV HTTP** | N/A | `jevsdev.com` — frame/decide without SSH |

**Do not ask operator to paste SSH keys in chat.**  
**Do not ask operator to re-enter Mac keys into Cursor dashboard unless they choose to.**  
**Wrong lane = say it once, give Mac command, stop.**

---

## 4. READ FIRST (do not redraw fleet)

| Doc | Where |
|-----|-------|
| ORICO_MAP | `~/Desktop/zynthio-tools/ALL_NOTES/ORICO_MAP.md` (Mac) |
| VDS manifest | `coreintentdev/zyn` → `18JUNE/vds-source-manifest.json` |
| Stack order | `coreintentdev/zyn` → `18JUNE/VDS_STACK_ORDER.json` |
| Domain wiki | `coreintentdev/zyn` → `18JUNE/domain-wiki-manifest.json` (**842 domains, STALE for live nginx**) |
| Doctrine pointers | `coreintentdev/zyn` → `manifests/CURSOR_OBEY_EXISTING_DOCTRINE_POINTERS_20260510.md` |

No fleet counts without live `nginx -T` + Porkbun prove.

---

## 5. LIVE status (origin probe 2026-09-30 ~22:27 UTC)

### Working

| Item | Proof |
|------|-------|
| JEV API | `https://jevsdev.com/health` → ok, jev-latest, 11553 lyrics |
| nica.futbol | Team site — Real España SJDS |
| kel.dog / kel.rip | Kel nameplate |
| yougetacut.com, noerus.net | Nameplates on origin |
| Internal APIs | :8000 :8011 :10087 :11434 **closed** on public IP (good) |

### Kelvin — partial (still wrong on some)

| Domain | Origin title | Verdict |
|--------|--------------|---------|
| nica.futbol | Real España SJDS | ✅ team lane |
| kelinsongs.com | Kelvin Jiménez Songs | ⚠️ off youlittledev; verify content lane |
| kelvinjimenez.com | Real España SJDS | ⚠️ **wrong lane** — team copy on song domain; should be music/songs not team |
| kelvinjimenez.net | youlittledev.com | ❌ |
| kelinjimenez.com | youlittledev.com | ❌ |
| kelin-songs.com | youlittledev.com | ❌ |

**youlittledev** = nginx default vhost catch-all — not a brand.

### Kelvin naming (operator corrected)

- Person: **Kelvin Jiménez** (not Kelin)
- **nica.futbol** = team football + team songs only
- **kelvinjimenez.com / kelinsongs.com** = music/songs lane — separate from team

---

## 6. What got merged in git (PR #30 → main)

Repo: `coreintentdev/coreintentai`  
Commit: `1ac69ec` — VDS bootstrap + Kelvin deploy **package** (not applied on VDS from Cloud)

| Path | Purpose |
|------|---------|
| `ops/vds/vds.sh` | status / ssh / deploy kelvin / prove kelvin |
| `ops/vds/bootstrap_*.sh` | mesh + SSH key from env secrets |
| `ops/vds/kelvin-domains/` | nginx conf + HTML + apply_on_vds.sh + PROVE.sh |
| `.cursor/Dockerfile` | Tailscale + openssh-client |
| `.cursor/environment.json` | start → bootstrap_vds.sh |
| `AGENTS.md` | Cloud rules |

**Cloud never ran `apply_on_vds.sh` on VDS** — no SSH path with real keys.

---

## 7. FINISH KELVIN — Mac one shot (operator has hands)

From Mac where `~/.ssh/zynthio_dc` already works:

```bash
git clone https://github.com/coreintentdev/coreintentai.git
cd coreintentai
git pull origin main

# Deploy Kelvin song domains on VDS
scp -r ops/vds/kelvin-domains root@100.121.107.112:/root/kelvin-domains-deploy/
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 'bash /root/kelvin-domains-deploy/apply_on_vds.sh' \
  | tee ~/Desktop/desk/PROVE-KELVIN-DOMAINS-$(date +%Y%m%d).md

# Verify titles from Mac or VDS
bash ops/vds/kelvin-domains/PROVE.sh
```

**Fix kelvinjimenez.com content:** deploy package HTML says music/songs — if origin still shows Real España team title, nginx on VDS has a **different** vhost winning; run on VDS:

```bash
nginx -T 2>/dev/null | grep -A2 'kelvinjimenez.com'
ls -la /root/sites/kelvinjimenez.com/ /var/www/
```

---

## 8. Live fleet audit (Mac SSH — not done)

```bash
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 '
  echo "=== DISK ==="
  df -h /
  echo "=== NGINX VHOST COUNT ==="
  nginx -T 2>/dev/null | grep server_name | sort -u | wc -l
  echo "=== LISTEN ==="
  ss -tlnp | head -40
'
```

Save output → `~/Desktop/desk/PROVE-VDS-AUDIT-$(date +%Y%m%d).md`

---

## 9. NOT DONE (no prove)

- discoversjds.com cluster / Suno GPU songs for Discover SJDS
- Suno credit burn before/after
- PROVE-KELVIN-DOMAINS on desk (until Mac runs apply)
- CANONICAL_DOMAINS_AND_SITES.json
- JEV `/health` path leak (`/root/zynthio/desk/handover/...` in JSON) — hygiene fix on VDS
- Cursor reasoning leak in UI (product defect)

---

## 10. Incidents filed (copy to `~/Desktop/desk/incidents/`)

| ID | File |
|----|------|
| Reasoning leak | `INC-20260930-CURSOR-AGENT-REASONING-LEAK.md` |
| Contradictory ops | `INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json` |
| Cloud no VDS | `INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS.md` |
| Kelvin partial | `INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE.md` |
| Deploy package | `INC-20260930-ACTION-KELVIN-DEPLOY-PACKAGE.md` |
| Full report | `INCIDENT-REPORT-ALL-20260930.md` |
| Maps | `ZYNTHIO-MAPS-20260930.md` |

Bundle: `incidents_20260930_bundle.json` (Grok offline, Qwen ok, Hermes, Ollama disk, JEV live)

---

## 11. Agent failures — do not repeat

1. Mood / emotion labels on operator in UI or leaked reasoning  
2. "If you want…" soft closes  
3. Disk % without `df` on VDS  
4. Stale JSON manifests as "today's fleet"  
5. Paste-SSH homework from Cloud lane  
6. Proton offload advice wrong direction (mirror **into** `/root/proton`)  
7. "Kelvin sites done" when origin still youlittledev  
8. Calling person "Kelin"  
9. Treating Cursor Cloud as VDS deploy lane when operator already has Mac SSH  

---

## 12. Cursor Cloud — why it failed (for support / next agent)

1. Cloud pod = isolated VM, no Mac keychain, no Tailscale session from Mac.  
2. Only path today: paste `ZYNTHIO_DC_SSH_KEY` + `HEADSCALE_PREAUTH_KEY` in Cursor dashboard → rebuild snapshot.  
3. Operator refused (10 months of same loop). Placeholder secrets → invalid key, mesh unreachable.  
4. **Product ask:** org-level secret store, Headscale OIDC, or "use operator's existing Tailscale" — not paste PEM in dashboard.  

Until then: **use Mac Cursor Remote-SSH to VDS** or run commands above from terminal.

---

## 13. What this Cloud session actually delivered

| Delivered | Not delivered |
|-----------|---------------|
| PR #30 merged (tooling in git) | Kelvin nginx fix on VDS |
| Incident docs + live HTTP probes | `df` / `nginx -T` from VDS |
| Maps from zyn repo | ORICO_MAP (Mac only) |
| 365 tests pass (library) | Suno prove, Discover SJDS |

---

## 14. Next human with SSH (5 minutes)

1. Run Kelvin `apply_on_vds.sh` (section 7)  
2. Run fleet audit (section 8)  
3. Save PROVE files to desk  
4. Fix kelvinjimenez.com if team title still wins over songs HTML  

**Do not open Cursor Cloud for this unless dashboard secrets are real.**

336 — VDS is boss. Mac has hands. Cursor Cloud does not.
