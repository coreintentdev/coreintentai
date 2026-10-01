# Incident Report — All (Good + Bad) — 2026-09-30 UTC

**Operator:** Corey McIvor  
**Reporter:** Cursor Cloud Agent bc-5c23d672  
**Verdict:** Mostly **process failure** with pockets of real progress. PR #30 merged but **Kelvin lane still incomplete**, **Cloud still cannot SSH**, and **prior agent sessions contradicted each other without prove**.

---

## Executive summary

| Category | Count |
|----------|-------|
| Bad / open | 9 |
| Good / verified | 6 |
| Mixed / partial | 4 |
| Action shipped, not applied on VDS | 1 (Kelvin deploy package) |

**Bottom line:** Infrastructure that works (JEV, team sites, internal API isolation) coexists with **10 months of groundhog-day agent loops**: paste-keys, mood labels, stale manifests treated as live, and "done" claims without origin prove. This session **documented and packaged fixes** but **did not finish VDS deploy** because secrets were never added to the Cloud environment.

---

## BAD incidents (open or pattern)

### INC-20260930-CURSOR-AGENT-REASONING-LEAK — **OPEN / PRODUCT**
- **What:** Internal agent coaching ("The user is frustrated…", "Thought for N seconds", "I will validate…") rendered in operator UI.
- **Impact:** Operator assigned emotional states they explicitly rejected ("not hurt" overwritten by "user is hurt").
- **Evidence:** `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-AGENT-REASONING-LEAK.md`
- **Status:** Cursor product defect — not fixed in this repo.

### INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS — **OPEN / BLOCKER**
- **What:** Cloud VM has no `ZYNTHIO_DC_SSH_KEY`, no `HEADSCALE_PREAUTH_KEY`, Tailscale route dead.
- **Live check (21:43 UTC):** `ops/vds/vds.sh status` → exit 1, both secrets MISSING.
- **Impact:** Cannot run `deploy kelvin`, `nginx -T`, `df -h`, Suno prove, or disk guard verify from Cloud.
- **Evidence:** `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS.md`

### INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS — **PATTERN**
- **What:** Same day: Cloud claimed ~99% disk without `df`; Grok claimed ~86% + guard installed; neither proved from shared artifact.
- **Also:** Cloud suggested offloading WhatsApp to Proton — **wrong direction** (manifest: Proton mirrors **into** `/root/proton`).
- **Evidence:** `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json`

### INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE — **STILL PARTIAL** (updated live)
- **Original filing:** All Kelvin song domains on youlittledev default.
- **Re-probe 21:43 UTC:** **Improved but wrong/mixed:**
  - ✅ nica.futbol, kel.dog, kel.rip — correct
  - ⚠️ kelinsongs.com — now has Kelvin title (was youlittledev) — **content lane unclear**
  - ⚠️ kelvinjimenez.com — shows **Real España team title** (operator rule: team = nica.futbol only; songs = separate)
  - ❌ kelvinjimenez.net, kelinjimenez.com, kelin-songs.com, kelvin.dog — still **youlittledev.com**
- **PR #30 deploy package:** merged to main — **`apply_on_vds.sh` NOT confirmed run from Cloud**
- **Evidence:** `/opt/cursor/artifacts/incidents/INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE.md`

### INC-20260930-GROK-OFFLINE-FALSE — **OPEN**
- Grok Bot macOS client false "no internet" while WAN fine.
- Workaround: Qwen API, Hermes, curl/JEV direct.
- **Evidence:** `/opt/cursor/artifacts/incidents_20260930_bundle.json`

### INC-20260930-VDS-DISK-PRESSURE — **OPEN / UNVERIFIED**
- Reported ~92% full, bulk copy paused.
- **Cloud never ran `df -h /` on VDS** — number is hearsay from Grok lane.
- **Risk:** Ollama nimble pull + Proton mirror under pressure.

### INC-20260930-AGENT-CAPTAIN-OBVIOUS — **PATTERN**
- Unprompted domain purchase offers, BUY STOP reminders, "I can't buy" filler during infra incidents.

### INC-20260929-ANTHROPIC-OUTAGE — **RESOLVED / LINGERING**
- Claude multi-surface outage Sep 29; some auth/timeout reports Sep 30.

### JEV path leak — **OPEN / SECURITY-HYGIENE**
- `GET /health` and `/context/lyrics` expose VDS filesystem paths (`/root/zynthio/desk/handover/...`).
- **Evidence:** `/opt/cursor/artifacts/vds-exposure-probe-20260930.log`

---

## GOOD incidents (verified)

### INC-20260930-JEV-FRAME-LIVE — **VERIFIED**
- `https://jevsdev.com/health` → 200, jev-latest, threshold 0.85, 11553 lyrics.
- `/frame` Problem-to-Questions works.
- **Re-probe 21:43 UTC:** still live.

### INC-20260930-QWEN-REBIND-OK — **VERIFIED** (operator/Gemini lane)
- Qwen key ending 54wc → HTTP 200; bad vjRX key parked.

### INC-20260930-HERMES-WIRED — **PARTIAL**
- Hermes on Mac + VDS per operator report; Cloud cannot reach :8000 on public IP (correct — mesh only).

### Fleet nameplates — **VERIFIED (origin)**
- yougetacut.com, noerus.net — correct titles on origin 5.189.143.170.

### Internal API exposure — **GOOD (security posture)**
- Ports 8000, 8011, 10087, 11434 **CLOSED** on public IP.
- **Evidence:** `/opt/cursor/artifacts/vds-exposure-probe-20260930.log`

### INC-20260930-ACTION-KELVIN-DEPLOY-PACKAGE — **GOOD (git only)**
- PR #30 **merged** 2026-09-30 21:36 UTC to `main`.
- Delivers: Dockerfile Tailscale, bootstrap scripts, `vds.sh`, Kelvin nginx/HTML package, AGENTS.md rules.
- **Not good until:** secrets in dashboard + snapshot rebuild + `vds.sh deploy kelvin` exit 0 + PROVE file on desk.

---

## MIXED

### INC-20260930-OLLAMA-NIMBLE — **MIXED**
- Good: Ollama 0.35.0 + nimble landed, classify test OK.
- Bad: disk 86%→92%; needs disk prove before more pulls.

### Kelvin domain drift — **MIXED**
- Some domains moved off youlittledev **without** this Cloud session applying PR #30 — unknown lane (Mac/Ruby/manual).
- kelvinjimenez.com content may be **wrong lane** (team copy on song domain).

### Maps / doctrine — **MIXED**
- Good: Pulled canonical maps from `coreintentdev/zyn`, wrote `/opt/cursor/artifacts/ZYNTHIO-MAPS-20260930.md`.
- Bad: ORICO_MAP.md still Mac-only; domain-wiki 842 domains **stale** vs live nginx.

---

## NOT DONE (operator asked, no prove)

| Item | Status |
|------|--------|
| PROVE-KELVIN-DOMAINS-YYYYMMDD.md on desk | Not created by Cloud |
| discoversjds.com cluster / Suno GPU songs | Not proved |
| Live fleet audit (`nginx -T` + Porkbun) | Blocked — no SSH |
| Suno credit burn before/after | No prove |
| CANONICAL_DOMAINS_AND_SITES.json | Missing |
| Cursor Cloud secrets (`ZYNTHIO_DC_SSH_KEY`, `HEADSCALE_PREAUTH_KEY`) | **Still missing** |

---

## What this session actually shipped

1. **Merged PR #30** — infrastructure for Cloud to stop paste-keys loop (not activated).
2. **Five incident files** under `/opt/cursor/artifacts/incidents/`.
3. **Live probes** — JEV, origin titles, port exposure.
4. **Maps artifact** — zyn manifests summarized.
5. **365 tests pass** — unrelated to VDS; does not prove deploy.

---

## Single unblock (operator)

Add **Runtime Secrets** in Cursor environment dashboard:
- `ZYNTHIO_DC_SSH_KEY`
- `HEADSCALE_PREAUTH_KEY`

Rebuild snapshot → `ops/vds/vds.sh status` exit 0 → `deploy kelvin` → `prove kelvin` → save PROVE to desk.

---

## Artifact index

```
/opt/cursor/artifacts/incidents/
  INC-20260930-CURSOR-AGENT-REASONING-LEAK.md
  INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json
  INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS.md
  INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE.md
  INC-20260930-ACTION-KELVIN-DEPLOY-PACKAGE.md
/opt/cursor/artifacts/incidents_20260930_bundle.json
/opt/cursor/artifacts/vds-exposure-probe-20260930.log
/opt/cursor/artifacts/vds-cli-status-test.log
/opt/cursor/artifacts/HANDOVER-CURSOR-SESSION-20260930.md
/opt/cursor/artifacts/ZYNTHIO-MAPS-20260930.md
/opt/cursor/artifacts/INCIDENT-REPORT-ALL-20260930.md  (this file)
```

336 — evidence only, no mood labels.
