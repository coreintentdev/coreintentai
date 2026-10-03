# INC-20261001-BAD-DESK-PATH-ARTIFACTS-NOT-ON-MAC

**Filed:** 2026-10-01 UTC  
**Reporter:** Corey McIvor  
**Category:** Agent delivery failure — phantom paths, wrong publish lane  
**Severity:** Major — operator ran commands that could not work; credits wasted  

---

## Summary

Cursor Cloud agent told operator to run:

```bash
bash ~/Desktop/desk/handover-pack-20261001/LAND-VDS-PROTON.sh
```

**Mac result:**

```text
bash: /Users/coreymcivor/Desktop/desk/handover-pack-20261001/LAND-VDS-PROTON.sh: No such file or directory
```

Files existed only on **Cloud VM** (`/opt/cursor/artifacts/`) — never copied to operator desk. Agent later said *"Sorry for the bad desk path — files are in git now"* — apology without prior incident filing; operator: *"all your bs you get away with most of it not documented as incident."*

---

## Root cause

1. Agent treated **Cloud artifacts** as if they were on operator Mac desk.  
2. No verify step (`test -f` / `ls`) before giving Mac path.  
3. Operator time burned on failed bash + confusion during refund/handover urgency.  
4. Most agent errors in thread **not filed as INC** until operator demanded it.

---

## Remediation attempted (2026-10-01)

| Lane | Action | Status |
|------|--------|--------|
| GitHub | Pushed to `coreintentdev/coreintentai` branch `cursorfix-kelvin-net-alias-238d` → `ops/handover/cursor-incidents-20261001/` | **Pushed** — PR #31 |
| VDS custom git | **Unknown to Cloud agent** — operator may use `/root/zynthio-tools` git or other remotes; not verified | **NOT DONE** |
| Mac desk | Operator must `git clone` + checkout branch | Pending operator |

---

## Operator question (on record)

*"why to github it will fail? or to vds git custom we have you dont know?"*

**Honest answer:**

- **GitHub `coreintentdev/coreintentai`** — push succeeded; Mac can clone if operator uses that repo. This repo is the **AI library**, not necessarily operator's canonical VDS deploy git (`zynthio-tools` / `zyn`).
- **VDS custom git** — per `zyn/18JUNE/vds-source-manifest.json`, canonical tree is `/root/zynthio-tools` on VDS and Mac `Desktop/zynthio-tools`. Cloud agent **does not know** which remotes/branches operator uses there without SSH prove.
- **Correct land path for operator stack** may be: clone/pull on Mac → `scp` or `rsync` to VDS desk — **not** assume GitHub is single source of truth for entire Zynthio fleet.

---

## Mac commands (verified path in GitHub — 2026-10-01)

```bash
git clone https://github.com/coreintentdev/coreintentai.git
cd coreintentai && git checkout cursorfix-kelvin-net-alias-238d
bash ops/handover/cursor-incidents-20261001/LAND-VDS-PROTON.sh
```

If operator uses VDS-local git instead, land via rsync from Mac checkout:

```bash
scp -i ~/.ssh/zynthio_dc -r ops/handover/cursor-incidents-20261001 \
  root@100.121.107.112:/root/zynthio/desk/handover/cursor-incidents-20261001
```

---

## Pattern: undocumented BS

Operator thesis: agents deflect with apologies (*"sorry bad path"*) without INC filing, so harm is not on desk for support/refund. This INC closes that gap for desk-path failure.

Cross-ref: INC-20261001-CURSOR-BILLING-ASYMMETRY, INC-20260930-CURSOR-GROUNDHOG-DAY-KEYS-CREDIT-WASTE.

---

## Status

**OPEN** — GitHub push done; VDS custom git lane unverified; desk land pending operator.

336
