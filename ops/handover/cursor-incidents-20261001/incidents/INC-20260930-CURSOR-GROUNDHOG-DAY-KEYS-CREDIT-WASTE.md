# INC-20260930-CURSOR-GROUNDHOG-DAY-KEYS-CREDIT-WASTE

**Filed:** 2026-09-30 UTC  
**Reporter:** Corey McIvor (@coreintentdev)  
**Category:** Agent process failure — recurring credential homework + credit burn  
**Severity:** Critical — operator time and billing impact across ~10 months  
**Channel:** Cursor Cloud Agent (coreintentdev/coreintentai and related repos)  

---

## Summary

Every new Cursor Cloud session re-opens the same blocked loop: agents cannot reach the VDS, ask the operator to supply Mac SSH keys or paste secrets into the Cursor dashboard, spin without executing deploy work, and consume credits while the operator repeats setup that already exists on the Mac lane. **This is groundhog day.** VDS SSH and Tailscale work from the operator's Mac. **Cursor Cloud is the broken lane.**

---

## Pattern (recurring daily / per-session)

| Step | What happens | Operator cost |
|------|----------------|---------------|
| 1 | Operator asks for VDS deploy, Kelvin domains, disk, nginx, Suno prove | Time |
| 2 | Cloud agent has no `zynthio_dc`, no mesh, no VDS hands | — |
| 3 | Agent asks to **paste SSH key**, add **ZYNTHIO_DC_SSH_KEY**, add **HEADSCALE_PREAUTH_KEY**, rebuild snapshot | Time + friction |
| 4 | Operator already has working Mac SSH (`~/.ssh/zynthio_dc`, `root@100.121.107.112`) and Tailscale (`zynthio @ headscale.kamals.pro`) | Repeated annoyance |
| 5 | Agent writes docs, incidents, PR scaffolding, HTTP probes — **does not apply nginx on VDS** | Credits |
| 6 | Next day / new agent: **same loop from step 1** | Groundhog day |

**Operator statement (2026-09-30):** *"every day new mac key ground hog day incident wasting credit and my time"*  
**Operator statement (2026-09-30):** *"ssh vds works. the ip on the tailscale works too just cursed cursor is the problem"*  
**Operator statement (2026-09-30):** *"i should not have to get passwords 10 months in from my main computer"*

---

## Evidence — this session (bc-5c23d672)

### Cloud agent blocked on keys (repeat)

```text
ops/vds/vds.sh status
  mesh key: present | MISSING (varies by boot)
  ssh key:  MISSING (ZYNTHIO_DC_SSH_KEY)
  route:    100.121.107.112 NOT reachable
  exit: 1
```

### Dashboard secret entry did not unblock (placeholder / wrong lane)

- Operator entered secrets in Cursor dashboard to satisfy env-setup flow.
- Cloud pod received **12-byte values** — not a valid PEM private key.
- SSH probe: `Load key ".../zynthio_dc": error in libcrypto`
- Public IP SSH: `Permission denied (publickey)`
- **Conclusion:** Session still blocked; credits spent on bootstrap retries and documentation.

### Work requested vs work done on VDS

| Operator ask | Cloud result |
|--------------|--------------|
| Wire Kelvin domains off youlittledev | HTTP probes only; `apply_on_vds.sh` **not run on VDS** |
| Fix disk / prove df | Contradictory % claims (99% vs 86%) — **no shared `df` artifact** |
| Stop paste-keys loop | PR #30 merged (bootstrap tooling) — **still requires dashboard key paste** |
| Use existing stack (JEV, Seamstress, VDS) | JEV probed live; Seamstress/VDS deploy not executed from Cloud |

### Git shipped; VDS unchanged by Cloud

- PR #30 merged to `main` (`1ac69ec`) — `ops/vds/vds.sh`, Kelvin deploy package.
- **Zero nginx changes applied on VDS from this Cloud session.**

---

## Evidence — prior sessions (same pattern)

| ID | Issue |
|----|-------|
| INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS | Cloud pod ≠ VDS; paste-keys homework |
| INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS | Claims without prove; wrong Proton advice |
| INC-20260930-CURSOR-AGENT-REASONING-LEAK | Internal reasoning in UI; operator state labels |
| INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE | "Done" overstated; origin still youlittledev on aliases |
| HANDOVER-FULL-20260930 | Mac SSH works; Cursor Cloud is wrong lane |

**Duration:** Operator reports ~**10 months** of the same loop.

---

## Root cause

1. **Cursor Cloud pods are isolated** — no access to Mac keychain, Mac Tailscale session, or VDS unless secrets are injected per-environment.
2. **Product design pushes credential homework to operator** — Runtime Secret paste for PEM + Headscale preauth, snapshot rebuild, repeat per environment/repo.
3. **Agents do not default to "wrong lane"** — they attempt Cloud deploy, fail, document, and ask again instead of handing off one Mac command.
4. **No shared PROVE artifacts** — Mac/Ruby/Grok/Cloud lanes do not write to one desk path agents read first.
5. **Stale manifests treated as live** — agents redraw fleet instead of reading ORICO_MAP + latest PROVE-*.

**Not root cause:** VDS down, SSH broken on Mac, Tailscale broken on Mac — **operator confirms both work outside Cursor.**

---

## Impact

| Impact | Detail |
|--------|--------|
| **Time** | Operator re-explains VDS, Kelvin rules, lane map every session |
| **Credits** | Cloud agents run long bootstrap/doc/probe loops without VDS deploy |
| **Trust** | "Done" claims contradicted by origin probes |
| **Deploy delay** | Kelvin aliases still on youlittledev; PROVE files not on desk |
| **Billing frustration** | Paying for agents that cannot use existing Mac hands |

---

## Expected behavior

1. Cloud agent detects **no VDS hands in first 60 seconds**.
2. Agent states: **wrong lane — use Mac SSH** with exact command block.
3. Agent does **not** ask for Mac key paste in chat or dashboard unless operator explicitly opts in.
4. Org-level or linked credentials for Headscale/SSH **or** Remote-SSH workflow documented as default for VDS repos.
5. Next agent reads `Desktop/desk/PROVE-*` and ORICO_MAP before any operational claim.

---

## Actual behavior

- New session → new key request → new bootstrap docs → same exit 1 on `vds.sh status`.
- Groundhog day.

---

## Remediation requested (Cursor product + agent doctrine)

### Product (Cursor)

1. **Stop billing-heavy retry loops** when VDS secrets missing — fail fast with lane handoff.
2. **Remote-SSH or linked Tailscale** for Cloud agents — use operator's existing mesh session, not PEM paste.
3. **Org secret store** — one-time `zynthio_dc` for team/env, not per-session dashboard homework.
4. **Fix reasoning leak** (see INC-20260930-CURSOR-AGENT-REASONING-LEAK).

### Agent doctrine (this repo — already partially in PR #30)

1. `AGENTS.md`: Cloud = library/tests; **VDS deploy = Mac SSH only** until product fixes above.
2. Never ask operator to paste keys in chat.
3. First action on VDS task: `wrong lane` + Mac one-liner OR prove SSH works — no spin.

### Operator lane (works today — no new keys)

```bash
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112
# Kelvin finish:
# see HANDOVER-FULL-20260930.md section 7
```

---

## Cross-refs

- `/opt/cursor/artifacts/HANDOVER-FULL-20260930.md`
- `/opt/cursor/artifacts/INCIDENT-REPORT-ALL-20260930.md`
- `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS.md`
- `ops/vds/SECRETS.md` — documents dashboard paste path operator rejects

---

## Status

**OPEN** — pattern active; operator filing for desk/support record.

336 — evidence only. No operator mood labels in this document.
