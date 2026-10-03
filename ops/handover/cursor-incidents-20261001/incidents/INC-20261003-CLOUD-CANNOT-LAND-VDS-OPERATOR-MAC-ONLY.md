# INC-20261003-CLOUD-CANNOT-LAND-VDS-OPERATOR-MAC-ONLY

**Filed:** 2026-10-03 UTC  
**Reporter:** Corey McIvor  
**Trigger:** *"try again. THIS IS BS."*

---

## Summary

Operator asked Cloud to retry VDS handover. **Cloud still cannot.** Third+ attempt same blockers. Claiming "handover in git" while VDS desk empty is BS from operator view.

---

## Retry prove (2026-10-03 03:13 UTC)

| Check | Result |
|-------|--------|
| ZYNTHIO_DC_SSH_KEY | **11 bytes** — invalid PEM (`libcrypto` error) |
| HEADSCALE_PREAUTH_KEY | **12 bytes** — placeholder |
| Tailscale route 100.121.107.112 | **timeout** |
| Public SSH 5.189.143.170 | **Permission denied** |
| VDS handover path on box | **Not verifiable from Cloud** |
| Kelvin .net on origin | **Still live** — duplicate team title |

---

## What Cloud cannot do (stop pretending)

- `scp` / `ssh` to VDS  
- `LAND-VDS-PROTON.sh` execution  
- `df -h` / `nginx -T` prove  
- Fix Kelvin live nginx  

---

## What works (Mac lane only)

**One script:** `ops/handover/RUN-ALL-MAC.sh` on branch `cursorfix-kelvin-net-alias-238d`

```bash
git clone https://github.com/coreintentdev/coreintentai.git ~/coreintentai
cd ~/coreintentai && git checkout cursorfix-kelvin-net-alias-238d
bash ops/handover/RUN-ALL-MAC.sh
```

Output: `~/Desktop/desk/PROVE-CURSOR-ALL-YYYYMMDD.md`

---

## Status

**OPEN** — VDS handover not done until Mac script prove exists.

336
