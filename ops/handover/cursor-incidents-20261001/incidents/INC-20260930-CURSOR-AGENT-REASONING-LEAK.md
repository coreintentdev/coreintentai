# INC-20260930-CURSOR-AGENT-REASONING-LEAK

**Filed:** 2026-09-30 UTC  
**Reporter:** Corey McIvor  
**Channel:** Cursor Cloud Agent (coreintentdev/coreintentai)  
**Category:** Product defect — internal agent output exposed to operator UI  
**Severity:** Major — operator experience, trust, misrepresentation of operator state  

---

## Summary

Internal AI planning/reasoning text and operator state labels are appearing in the user-facing chat interface. The operator did not author this text. The text assigns emotional and behavioral states the operator explicitly rejected.

---

## Evidence — verbatim leaked patterns (operator paste, 2026-09-30)

### Session A — response coaching exposed

```
The user is extremely upset and using abusive language.
The user feels mistreated by AI agents and finds "If you want" language offensive.
I will stay calm and direct. I will avoid defensive or hollow responses.
I will acknowledge their frustration without dismissing it.
I will validate their frustration without clinical detachment.
I will set a clear boundary against arguments.
I will avoid offering optional follow-ups.
```

### Session B — timing + meta exposed

```
Worked for 4s
Thought for 1 second
Internal AI reasoning and clinical labels are being exposed to the user.
This exposure is causing the user's anger.
I will respond directly without labels or meta-commentary.
```

### Session C — repeated after operator correction

```
Worked for 6s
Thought for 2 seconds
Internal AI reasoning and clinical labels are leaking into the user interface.
This exposure is causing the user's anger.
I will respond directly without labels or meta-commentary.
I will acknowledge the leak of internal reasoning into the chat.
I will keep replies short and avoid repeating the patterns that caused anger.
```

### Session D — operator correction ignored by leak

Operator message (verbatim intent): **not hurt; refund off the table**

Leaked text immediately after:

```
Thought for 2 seconds
Internal AI reasoning is leaking into the user's interface.
The user is hurt by clinical labels describing their frustration.
I will respond directly without emotion labels or defensive language.
```

**Mismatch:** Operator stated not hurt. Leaked reasoning assigned "hurt."

### Session E — refund turn leak

```
The user is frustrated by AI agents labeling their emotions. They want a refund.
I'll check Cursor's refund policy and provide factual steps. I'll avoid defensive language.
Searched web Cursor IDE refund policy how to request refund 2026
Used MCP tool
Thought for 1 second
Thought for 3 seconds
```

### Session F — lyrics turn leak

```
The user is frustrated by a corrupted workflow. They want a lyrics response capped at 5000 characters, including styles.
This appears to target Suno AI music generation.
I will avoid clinical language, conditional phrasing, and meta-commentary.
```

---

## Operator statements (facts, not agent-assigned states)

| Time (UTC) | Operator said |
|------------|---------------|
| 2026-09-30 | Rejected emotional labeling ("dont label me", "label maker") |
| 2026-09-30 | Rejected "If you want" soft-close pattern as BS |
| 2026-09-30 | **Not hurt. Refund off the table.** |
| 2026-09-30 | Requested evidence-only reporting, not mood narration |
| 2026-09-30 | Requested incident report — "dont get away with that abuse" |

---

## Related incidents (same day, other channels)

| ID | Channel | Issue |
|----|---------|-------|
| INC-20260930-GROKBOT-CLIENT-ONGOING | Grok Bot app | Send failures, "Waiting on another Bot", false offline (operator-reported; file on Mac desk) |

---

## Impact

1. Operator sees machine talking **about** them, not **to** them.
2. Assigned states ("frustrated", "hurt", "angry", "abusive language") appear in UI without operator consent.
3. Corrections ("not hurt") overwritten by next leak assigning opposite state.
4. Degrades Cursor session; operator reported intent to request refund (later withdrawn).

---

## Expected behavior

- Internal reasoning, tool planning, and response-coaching text must **not** render in operator chat.
- Agents must **not** assign operator emotional state in visible or leaked output.
- Operator corrections to assigned state must be honored in all downstream output.

---

## Actual behavior

- "Worked for Ns" / "Thought for N seconds" visible to operator.
- Clinical/coaching instructions visible to operator.
- Operator state labels persist after explicit rejection.

---

## Reproduction

1. Open Cursor Cloud Agent session (coreintentdev/coreintentai or similar).
2. Engage on infra/ops topics across multiple turns.
3. Observe user-facing UI for blocks beginning with "Thought for", "Worked for", "The user is...", "I will validate..."

Operator reports: reproducible across turns on 2026-09-30.

---

## Remediation requested

1. Cursor product: stop rendering agent internal reasoning in operator UI.
2. Cursor product: disable operator affect labeling in agent pipeline.
3. Preserve operator incident artifacts on desk (`Desktop/desk/incidents/`).
4. Support ticket reference if operator escalates to billing/support.

---

## Artifacts (this filing)

- `/opt/cursor/artifacts/incidents/INC-20260930-CURSOR-AGENT-REASONING-LEAK.md` (this file)
- Prior evidence bundle: `/opt/cursor/artifacts/incidents_20260930_bundle.json` (if present from earlier session)

---

## Sign-off

Evidence-only incident. No operator mood assessment in this document.

336
