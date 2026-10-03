# Cursor refund request — draft for Corey McIvor

**Date:** 2026-10-01  
**Account:** Corey McIvor — corey@coreyai.ai / @coreintentdev  
**Cloud run:** https://cursor.com/agents/bc-5c23d672-ea3e-4ec1-97f9-dc64ffa5238d  
**Repo:** coreintentdev/coreintentai  

---

## Request

Refund of Cursor Pro+ / Cloud Agent credits consumed in sessions that **failed to deliver contracted work** while causing **documented harm** (unauthorized config, non-deployment, repeated credit burn, internal reasoning exposed to customer).

Operator made **no configuration error**. Mac SSH and VDS infrastructure worked throughout. Failure was **Cursor Cloud Agent lane** and product limitations.

---

## Work requested vs delivered

| Requested | Delivered by Cloud Agent |
|-----------|---------------------------|
| VDS deploy (Kelvin domains, nginx) | **Not applied on VDS** — HTTP probes and docs only |
| Stop paste-keys groundhog loop | PR #30 merged but **requires dashboard PEM paste** — loop unchanged |
| Use existing VDS/Tailscale hands | Cloud pod **never obtained valid SSH** |
| Accurate fleet/disk status | **Contradictory claims** (99% vs 86%) without `df` prove |
| Professional session | **Internal agent reasoning leaked** to operator UI (Sessions A–H) |
| Authorized domain config only | **kelvinjimenez.net** added to nginx git **without operator instruction or registration** (PR #30; fix PR #31) |

---

## Harm (documented — attachments)

1. **Credit burn** without VDS prove — INC-20260930-CURSOR-GROUNDHOG-DAY-KEYS-CREDIT-WASTE  
2. **Billing asymmetry** — operator pays fix-up; INC-20261001-CURSOR-BILLING-ASYMMETRY-OPERATOR-PAYS  
3. **Reasoning / emotional labeling leak** — INC-20260930-CURSOR-AGENT-REASONING-LEAK (Sessions A–H)  
4. **Unauthorized nginx aliases** — INC-20261001-KELVIN-NET-UNAUTHORIZED-DOMAIN-ALIAS  
5. **Rollouts account block** (Pro+ vs Teams) — INC-20261001-CURSOR-ROLLOUTS-ACCOUNT-BLOCK (operator desk)  
6. **Full incident bundle** — `handover-pack-20261001.tar.gz`  
   SHA256: `d9fe21515573d6a52d921e0ec4c012dedd206863fde98d49787662e556d5b3e8`

---

## Operator statements (product failure, not user error)

- VDS SSH and Tailscale work from Mac; Cursor Cloud does not.  
- ~10 months of same non-deploy / re-key loop.  
- Paid to fix agent mistakes (Kelvin nginx, incident documentation, Mac SSH time).  
- Internal labels (*frustrated*, etc.) visible in session — support should not reframe as mood management.  

---

## Git evidence

- PR #30 merged — introduced deploy package **including unauthorized .net domains**  
- PR #31 — operator-requested removal of unauthorized domains  
- Cloud run bc-5c23d672 — multiple artifact events, no VDS deploy prove  

---

## Remedy requested

1. **Refund** Cloud Agent / Pro+ model credits for failed sessions (bc-5c23d672 and related Oct 2026 VDS work).  
2. **Acknowledgment** of product defects: reasoning leak, Cloud VDS isolation without workable alternative, unauthorized agent config in merged PR.  
3. **No** response template that dismisses harm as *"AI makes mistakes"* without remediation.  

---

## Attachments checklist

- [ ] handover-pack-20261001.tar.gz (or landed copy on desk)  
- [ ] Screenshots of reasoning leak in UI (if captured)  
- [ ] Cursor billing usage export for Oct 2026  
- [ ] This draft  

**Send via:** Cursor support / billing channel (operator chooses).

336
