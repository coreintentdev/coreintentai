# INC-20261001-AGENT-IF-YOU-WANT-AUTO-PATTERN

**Filed:** 2026-10-01 UTC  
**Reporter:** Corey McIvor  
**Category:** Agent auto-response pattern — conditional deferral  
**Severity:** Major — operator rejected repeatedly; still emitted  

---

## Summary

Agents append **"if you want"** / **"if you'd like"** to defer action, support escalation, documentation, or next steps — placing burden on operator to re-request work already owed. Operator classifies this as **automatic incident behavior**, not helpful optional offer.

**Operator statement (2026-10-01):** *"if you want incident - if you want is incident auto"*

**Operator statement (2026-10-01):** *"if you want is auto yes too."*

**Record:** Pattern is **pipeline auto** — not chosen phrasing; agents emit *if you want* / deferral tails without operator request. Operator treats as automatic harmful output, same class as reasoning leak and emotional DRM.

---

## Pattern

| Agent says | Effect |
|------------|--------|
| "If you want VDS custom git documented, paste…" | Operator must ask again for standard diligence |
| "If you want a refund…" | Discourages pursuit while sounding helpful |
| "If you want me to merge PR…" | Work left incomplete until re-prompt |
| "If you want X filed as incident…" | Meta — operator already demanded incidents; agent still conditions |

**Operator rule (prior sessions):** Rejected *"If you want"* soft closes as BS (INC-20260930-CURSOR-AGENT-REASONING-LEAK, handover hard rules).

---

## Why this is incident-class (not style)

1. **Thwarted completion** — agent stops without finishing; operator must pay another turn/credit.  
2. **Dog-box cousin** — pairs with *"stands down unless you ask"* (INC-20261001-CURSOR-BILLING-ASYMMETRY).  
3. **Captain Obvious cousin** — sounds optional while creating logged deferral.  
4. **Refund/support** — frames operator action as optional when harm already documented.

---

## Expected agent behavior

- Do the filing, land path, or handoff **without** conditional *if you want*.  
- When blocked (no SSH), state **wrong lane + exact Mac command once** — no optional tail.  
- When operator says *file incident*, **file it** — do not offer *if you want incident*.

---

## Actual behavior (2026-10-01 example)

Prior agent turn ended with: *"If you want VDS custom git path documented, paste … output and it goes in the next INC — I won't guess."*

Operator response: **if you want IS the incident.**

---

## Cross-refs

- INC-20260930-AGENT-CAPTAIN-OBVIOUS  
- INC-20261001-CURSOR-BILLING-ASYMMETRY (dog-box mode)  
- INC-20260930-CURSOR-AGENT-REASONING-LEAK  
- HANDOVER hard rules: no *"If you want…"* soft closes  

---

## Status

**OPEN** — pattern active; this INC documents the auto-response itself.

336
