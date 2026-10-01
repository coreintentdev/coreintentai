# Thread status — done vs VDS handover — 2026-10-01 23:16 UTC

**Verdict:** Documentation **done in GitHub**. **NOT landed on VDS or Proton** (no checksum prove from this lane).

---

## Thread checklist

| Thread | Doc done | Git | VDS | Proton | Live fixed |
|--------|----------|-----|-----|--------|------------|
| Cursor incidents + handover pack | ✅ 10 INC + thread | ✅ branch `cursorfix-kelvin-net-alias-238d` | ❌ not landed | ❌ not landed | — |
| Refund request draft | ✅ | ✅ in pack | ❌ | ❌ | — |
| Kelvin .net unauthorized | ✅ INC | ✅ PR #31 open | ❌ live still has .net aliases | — | ❌ |
| Kelvin nginx deploy | ✅ package in main | ✅ PR #30 merged | ❌ apply never run from Cloud | — | ❌ partial/wrong lane |
| VDS disk capacity | ✅ probe log | ✅ | ❌ no `df` | — | ❌ unverified |
| VDS SSH / Cloud hands | ✅ INC | ✅ bootstrap in main | — | — | ❌ Cloud exit 1 |
| Groundhog keys / credit waste | ✅ INC | ✅ | — | — | ❌ product open |
| Reasoning leak / emotional DRM | ✅ INC A–H | ✅ | — | — | ❌ product open |
| Billing asymmetry / dog-box / if-you-want | ✅ INC | ✅ | — | — | ❌ |
| Bad desk path | ✅ INC | ✅ | — | — | ❌ Mac must pull git |
| Rollouts account block | ✅ (operator desk ref) | — | ❓ operator said on VDS | ❓ | — |
| Bot census 45 / sirbotforgotalot | — | ❌ not this repo | ❌ operator lane | ❌ operator lane | ❌ |
| Maps (zyn) | ✅ summary | ✅ in pack | — | — | — |
| PR #31 merge | — | ❌ **OPEN** | — | — | — |

---

## VDS land prove (required — missing)

Expected after `LAND-VDS-PROTON.sh`:

```
/root/zynthio/desk/handover/cursor-incidents-20261001/
sha256sum -c MANIFEST.sha256 → OK
~/Desktop/desk/PROVE-CURSOR-HANDOVER-LAND-YYYYMMDD.md
```

**Cloud cannot verify this path** — no SSH. Operator/Ruby must confirm.

Quick Mac check:

```bash
ssh -i ~/.ssh/zynthio_dc root@100.121.107.112 \
  'ls -la /root/zynthio/desk/handover/cursor-incidents-20261001 2>&1 | head -5'
```

---

## One command to finish handover land

```bash
git clone https://github.com/coreintentdev/coreintentai.git
cd coreintentai && git checkout cursorfix-kelvin-net-alias-238d
bash ops/handover/cursor-incidents-20261001/LAND-VDS-PROTON.sh
```

336
