# INC-20260930-CURSOR-CLOUD-NO-VDS-ACCESS

**Filed:** 2026-09-30 UTC  
**Reporter:** Corey McIvor  
**Subject:** Cursor Cloud Agent cannot execute VDS work — recurring "no SSH" blocker while operator expects deploy  
**Severity:** Major — blocks nginx/domain fixes, disk ops, Suno burn proof, Kelvin domain wiring  

---

## Summary

Cursor Cloud Agents run on an isolated VM (`coreintentdev/coreintentai`) with **no `zynthio_dc` SSH key**, **no Tailscale**, and **no nginx/docroot on the pod**. Operator stack doctrine: **VDS is boss** for deploy. Cloud agents probe HTTP and write docs but **cannot complete VDS tasks**, yet sessions repeatedly imply work is blocked on operator "paste SSH" instead of fixing the lane.

---

## Evidence — SSH failures (this session)

```text
ssh root@100.121.107.112 → Connection timed out
ssh root@5.189.143.170 → Permission denied (publickey,password)
```

**Cloud agent environment (bc-5c23d672):**
- Repo: `github.com/coreintentdev/coreintentai` only
- Personal environment — no committed `.cursor/environment.json` with VDS bootstrap
- Egress: unrestricted (network not the blocker — **credentials/path are**)

---

## Work blocked on VDS (operator asked, not done from cloud)

| Task | Cloud agent action | VDS action |
|------|-------------------|------------|
| Kelvin domains off youlittledev | HTTP probe only | nginx vhost + docroot **not edited** |
| Disk reclaim / guard install | Advice + incident | Grok/Ruby claimed done — cloud could not verify live |
| Suno credit burn proof | None | Requires VDS `suno-stack credits` |
| nica.futbol / kel.dog | Verified via origin curl | Already live — no cloud deploy needed |

---

## Root cause

1. **Cloud pod ≠ VDS** — separate machine, no operator SSH key injected.  
2. **Deploy truth lives on VDS** (`/etc/nginx`, `/var/www`, `/root/sites`) — not in `coreintentai` git.  
3. **No git-based deploy pipeline** for domain vhosts from this repo → cloud cannot push config.  
4. **Agent handoff gap** — Mac/Ruby SSH lane and Cloud lane do not share PROVE artifacts automatically.

---

## Operator impact

- Same request repeated across sessions ("wire Kelvin domains", "fix disk", "burn Suno").  
- Cloud agent says "I cannot SSH" → reads as runaround when operator already configured SSH elsewhere.  
- Statements of completion from one lane contradicted by cloud probes (99% vs 86%, kelinsongs broken).

---

## Remediation options (pick one — operator decision)

### A. Cursor Cloud environment — add VDS hands (recommended for "ask once")

In Cursor dashboard → Cloud Agent environment for `coreintentai` (or `zyn`):

1. **Secret:** `ZYNTHIO_DC_SSH_KEY` — private key material (same as Mac `~/.ssh/zynthio_dc`).  
2. **install** script: write key `0600`, `ssh-keyscan` Tailscale IP, test `ssh -i … root@100.121.107.112 df -h /`.  
3. **Optional:** install `tailscale` on pod OR restrict to public IP if key allows.  
4. Add **`coreintentdev/zyn`** to `repositoryDependencies` if deploy scripts live there.  
5. Rebuild environment snapshot; verify agent can run read-only `df` + `nginx -T` before write ops.

Docs: https://cursor.com/docs/cloud-agent/setup

### B. Git deploy lane (no SSH on cloud)

1. Store nginx vhosts + static sites in **`coreintentdev/zyn`** (or deploy repo).  
2. VDS pulls via cron/webhook: `git pull && deploy-domains.sh`.  
3. Cloud agent commits config; VDS applies — one PROVE curl after hook.

### C. Mac Cursor only for VDS (status quo)

- Cloud = library/tests/docs.  
- **Mac Cursor Remote SSH** or **Grok/Ruby** = all nginx/domain/disk work.  
- Document in AGENTS.md: **Cloud agents must not claim VDS deploy without PROVE from SSH lane.**

---

## Hard rule for agents

> **No "paste SSH output" from Cloud lane.** Either environment has VDS SSH, or agent commits deploy artifacts to git and assigns one line for VDS pull — or explicitly states: **wrong lane, use Mac/Ruby.**

---

## Cross-refs

- INC-20260930-KELVIN-DOMAINS-PARTIAL-DONE.md  
- INC-20260930-CURSOR-AGENT-CONTRADICTORY-OPS.json  
- ORICO_MAP.md — VDS = boss  

336
