# INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE

**Filed:** 2026-09-30 UTC  
**Reporter:** Corey McIvor  
**Subject:** Kelvin / Kel domain lane — mixed done vs broken; agent statements overstated completion  
**VDS:** zynthio-vds-7372 (`5.189.143.170`)  
**Verifier:** Cursor Cloud Agent (HTTP origin probes + public curl)

---

## Verdict

**NOT fully done.** Two lanes are live on VDS origin. Song/personal Kelvin domains are still on **youlittledev.com** default vhost. Treating “Kelvin sites done” as complete is **false**.

---

## DONE (proved on VDS origin 2026-09-30)

Probe: `curl -H "Host: <domain>" http://5.189.143.170/`

| Domain | HTTP | Title / H1 | Purpose |
|--------|------|------------|---------|
| **nica.futbol** | 200 | Real España SJDS — Kelvin Jiménez · nica.futbol / H1: Real España — San Juan del Sur | Football team + team songs |
| **kel.dog** | 200 | Kel — kel.dog / H1: Kel | Kel short brand nameplate |
| **kel.rip** | 200 | Kel — kel.rip / H1: Kel | Kel short brand nameplate |

**Operator rule confirmed:** `nica.futbol` = Real España team (songs made for team), **not** kelinsongs catalog.

---

## NOT DONE (proved broken on VDS origin)

All serve **youlittledev.com** default — wrong site:

| Domain | Origin HTTP | Title |
|--------|-------------|-------|
| kelinsongs.com | 200 | youlittledev.com |
| kelinjimenez.com | 200 | youlittledev.com |
| kelvinjimenez.com | 200 | youlittledev.com |
| kelvinjimenez.net | 200 | youlittledev.com |
| kelin-songs.com | 200 | youlittledev.com |
| kelvin.dog | 200 | youlittledev.com (on VDS) |

**Impact:** Kelvin songs / personal catalog domains not deployed. nginx default_server or missing vhost.

---

## PARTIAL / EDGE

| Domain | Note |
|--------|------|
| nica.futbol | Public HTTPS returned **403** (Cloudflare challenge) from cloud curl; **origin content correct** |
| kel.dog | Public HTTPS **403** (Cloudflare); origin correct |
| kelvin.dog | Public HTTPS **200** → **Shopify** storefront (not VDS Kel page); VDS vhost still youlittledev if pointed at box |

---

## Agent statement vs reality

| Agent claim pattern | Reality |
|---------------------|---------|
| "nica.futbol live for team" | **TRUE** on origin |
| "Kelvin sites done" / kelinsongs wired | **FALSE** — kelinsongs.* still youlittledev |
| "See existing kelin site" on kelinsongs.com | **FALSE** — no kelin site there today |

---

## Remediation (not executed — no VDS SSH from this session)

1. nginx: dedicated server_name blocks for kelinsongs.com (+ aliases) → Real Kel songs docroot (not nica.futbol — team stays on nica.futbol).
2. Remove kelinsongs / kelvinjimenez* from default/youlittledev catch-all.
3. CF: purge cache for nica.futbol / kel.dog if browser shows wrong content.
4. kelvin.dog: decide Shopify vs VDS — do not leave split-brain.
5. PROVE file after fix: `Desktop/desk/PROVE-KELVIN-DOMAINS-YYYYMMDD.md` with curl origin + public titles.

---

## Evidence commands (repeatable)

```bash
# Origin truth
for d in nica.futbol kel.dog kel.rip kelinsongs.com kelvinjimenez.com kelvin.dog; do
  echo -n "$d: "
  curl -sS -H "Host: $d" http://5.189.143.170/ | grep -o '<title>[^<]*' | head -1
done
```

---

## Cross-refs

- INC-20260930-CURSOR-AGENT-REASONING-LEAK.md
- INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json
- domain-wiki-manifest.json: kel.dog = PARK 8MO (manifest stale vs live nameplate)

336
