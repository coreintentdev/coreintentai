# Zynthio Maps — canonical reference (2026-09-30)

**Source of truth:** `coreintentdev/zyn` on GitHub + Mac `Desktop/zynthio-tools/ALL_NOTES/ORICO_MAP.md`  
**Not in this repo:** `coreintentai` — agents should read zyn manifests, not redraw from memory.

---

## 1. VDS topology (`18JUNE/vds-source-manifest.json`)

| Field | Value |
|-------|-------|
| Host | `zynthio-vds-7372` |
| Tailscale | `100.121.107.112` |
| Public origin | `5.189.143.170` |
| Root | `/root` |
| Signal | 336 |

### Data sources (Mac → VDS)

```
┌─────────────────┐     rsync/rclone      ┌──────────────────────────────┐
│ Mac             │ ────────────────────► │ VDS /root/zynthio            │
│ zynthio-tools   │                       │      /root/zynthio-tools     │
│ suno-batch      │                       │      /root/suno-batch        │
└─────────────────┘                       └──────────────────────────────┘
┌─────────────────┐     rclone            ┌──────────────────────────────┐
│ Google Drive    │ ────────────────────► │ /root/takeout/*              │
│ (8 remotes)     │                       │ /root/zynthio/gdrive-mirror  │
└─────────────────┘                       └──────────────────────────────┘
┌─────────────────┐     rclone            ┌──────────────────────────────┐
│ Proton vault    │ ────────────────────► │ /root/proton                 │
└─────────────────┘                       └──────────────────────────────┘
┌─────────────────┐     selective rsync   ┌──────────────────────────────┐
│ ORICO SSD       │ ────────────────────► │ VDS offload archives         │
│ /Volumes/ORICO  │                       │                              │
└─────────────────┘                       └──────────────────────────────┘
```

### Tools on VDS

| Tool | Path |
|------|------|
| zynrip | `/usr/local/bin/zynrip` |
| zynrip-vds | `/usr/local/bin/zynrip-vds` |
| Seamstress | `/root/zynthio-tools/18JUNE/master_seamstress_vds.py` |
| Orchestrator | `/root/zynthio-tools/18JUNE/zyn_intel_orchestrator.py` |
| Commander | `/usr/local/bin/commander` |

### Outputs (Seamstress weave)

| Artifact | Path |
|----------|------|
| MASTER_CONTEXT | `/root/zynthio/_meta/MASTER_CONTEXT.md` |
| MASTER_THREADS | `/root/zynthio/_meta/MASTER_THREADS.md` |
| Intel index | `/root/zynthio/_meta/SOVEREIGN_INTEL_INDEX.json` |
| Deploy queue | `/root/zynthio/_meta/DEPLOY_QUEUE.md` |

### Internal services (mesh/local — not public)

| Service | Port |
|---------|------|
| Hermes | 8000 |
| Mosoko translate | 8011 |
| wrabbit daemon | 10087 |
| Ollama | 11434 |

### Deploy phases (doctrine order)

1. **scan** — inventory all sources on VDS  
2. **seamstress** — weave chat exports → MASTER_THREADS + MASTER_CONTEXT  
3. **zynrip** — harvest legal/music/infra profiles  
4. **nginx** — DNS park 444 OR allowlist BUILD only (no skeleton)  
5. **go-live** — DEPLOY_QUEUE top items on VDS  

---

## 2. Stack sync order (`18JUNE/VDS_STACK_ORDER.json`)

12 layers Mac → VDS (rsync order):

| Layer | Name | Canon path | VDS target |
|-------|------|------------|------------|
| 0 | doctrine_env | CLAUDE.md, SOVEREIGN_PAIR_DOCTRINE | `/root/.zynthio.env`, `_meta` |
| 1 | chat_exports_raw | `tidy/chats-exports/` (4.1G) | `/root/zynthio-tools/tidy/chats-exports/` |
| 2 | chat_exports_clean | `6June/chats-for-ollama-hermes/` | same tree → `zynrip-vds seamstress` |
| 3 | zynrip_real | `tidy/zynrip-real/` (772M) | `/root/zynthio-tools/tidy/zynrip-real/` |
| 4 | 18june_active | `18JUNE/` (2.0G) | `/root/zynthio-tools/18JUNE/` |
| 5 | wrabbit_webbridge | `wrabbit-web-bridge-v2/` | + Hermes/Mosoko/wrabbit services |
| 6 | frontend_apps | songpal-app, zynthio-portal, zyngit, zynlore | — |
| 7 | generated_sites | `18JUNE/generated-sites/` (111 sites) | `/var/www/{domain}/public/` |
| 8 | domain_intel | domain-wiki, fleet-packages, kervalon | `/root/zynthio/distillates/` |
| 9 | comms_evidence | whatsapp, email, proton | legal lanes |
| 10 | music_suno | suno-rips, jazz batch | `/root/suno-batch/downloads` |
| 11 | legal_kelvin | `kelvin/`, defamation, ACCC | — |

### Order of operations (from manifest)

1. Tailscale auth + `ssh root@100.121.107.112`  
2. rsync 18JUNE + tidy/chats-exports + tidy/zynrip-real → VDS  
3. `zynrip-vds scan`  
4. `zyn_chat_exporter.py` (Mac) → rsync chats-for-ollama-hermes  
5. `zynrip-vds seamstress` → MASTER_CONTEXT  
6. `deploy_web_weave_batch.sh`  
7. `deploy_mosoko_multilingual.sh` (if not live)  
8. ORICO mount → `zynrip-vds harvest-live`  
9. `corey_sync 336zm`  

---

## 3. Domain fleet (`18JUNE/domain-wiki-manifest.json`)

**842 domains** — mostly PARK. **STALE for live nginx status** (use `nginx -T` on VDS or origin probes).

| Action | Count |
|--------|-------|
| PARK 8MO | 622 |
| PARK → BUILD | 137 |
| BUILD | 68 |
| PRIVATE | 13 |

| Cluster | Count |
|---------|-------|
| general-park | 571 |
| pal-vertical | 83 |
| ais-ai-song | 27 |
| pelican-maritime | 21 |
| video-reversed-oediv | 18 |
| news-factory | 17 |
| zynthio-brand | 17 |
| songpal-singpal | 11 |
| 336-signal | 7 |

**Named in manifest (sample):** `zynthio.ai` BUILD · `nica.futbol` PARK 8MO · `kel.dog`/`kel.rip` PARK 8MO · songpal.* BUILD cluster  

**Not in domain-wiki JSON:** kelvinjimenez.com, jevsdev.com, discoversjds.com — track live via nginx/Porkbun, not this file alone.

---

## 4. Doctrine pointer index

`manifests/CURSOR_OBEY_EXISTING_DOCTRINE_POINTERS_20260510.md` → read these on Mac/VDS, don't re-litigate in chat:

- `LESSONS_SUNO_AUTOMATION_DOCTRINE_336.md` — Suno browser automation  
- `VDS_DEPLOY_MANIFEST_336_20260505.md` — incremental deploy waves  
- `CONTEXT_BUNDLE_FOR_LANES_336_20260505.md` — four lanes, ZYNASK, **never touch `/root/silver_bot/`**  
- `OPERATOR_POLICY_PROTON_ONLY_20260510.md` — VDS is boss, Grok research-only  
- `DOCTRINE_MILTON_CLIPBOARD_AUDIT...` — ask-don't-answer under strife  

---

## 5. ORICO map (Mac only)

**Path:** `~/Desktop/zynthio-tools/ALL_NOTES/ORICO_MAP.md`  
**Not in GitHub zyn repo** — Cloud agents cannot read it until synced or added as repo dependency.

ORICO archives referenced in vds-source-manifest:
- COMMANDER_OFFLOAD_20260425_231037  
- _BUILD_SAFE_20260424  
- ALPHA_SAFE_20260426_003128  
- zynthio_backup_20260422_0535  
- zynthio_full_backup_20260422_0935  

---

## 6. Live lane map (probed 2026-09-30 — not manifest)

| Lane | Domain / endpoint | Status |
|------|-------------------|--------|
| JEV API | jevsdev.com | ✅ live (`jev-latest`, 0.85 gate) |
| Kelvin team | nica.futbol | ✅ live (team only) |
| Kelvin songs | kelvinjimenez.com, kelinsongs.com | ⚠️ mixed / deploy pending |
| Kelvin aliases | kelvinjimenez.net, kelinjimenez.com, kelin-songs.com | ⚠️ some still youlittledev default |
| Core fleet | yougetacut.com, noerus.net, kel.dog | ✅ |
| Discover SJDS | discoversjds.com | legacy 301 |
| Internal AI | :8000 :8011 :10087 :11434 | closed on public IP (mesh only) |

**youlittledev** = nginx default vhost catch-all — not a product brand.

---

## 7. Cloud agent entry (this repo)

```bash
ops/vds/vds.sh status          # needs ZYNTHIO_DC_SSH_KEY + mesh
ops/vds/vds.sh deploy kelvin   # apply Kelvin nginx package on VDS
ops/vds/vds.sh prove kelvin    # origin title checks
```

Secrets: Cursor dashboard → **Runtime Secret** (not Build Secret).
