# CONCORD — One-Page Summary

**Cleanverse Build Hackathon · Aug 2026**

---

## Problem

AI agents can trade tokens today — but they cannot form bilateral economic relationships with each other. There is no protocol for two agents to negotiate bespoke terms, verify each other's identity, lock funds in escrow, continuously monitor compliance, trigger renegotiation when conditions degrade, and settle disputes — all autonomously. Every B2B financial relationship today requires human legal and operational infrastructure that does not exist on-chain.

## Solution

CONCORD is the first **Autonomous Economic Relationship Protocol (AERP)** — a three-layer system that enables two AI agents to form, manage, monitor, renegotiate, and settle bilateral economic treaties with zero human intervention.

- **Layer 1 — Identity & Rules:** Cleanverse CVI anchors agent identity (Tier 1-5). An on-chain ConstitutionRegistry enforces immutable per-agent rules. No identity → no treaty. Rules violated → treaty blocked.
- **Layer 2 — Autonomous Operations:** A TypeScript agent service runs the full treaty lifecycle — structured negotiation, constitutional validation, activation, 10-condition monitoring every 15 seconds (Parry pattern), degradation detection, and renegotiation.
- **Layer 3 — Dispute Resolution:** A 3-agent Mediator Swarm with 2/3 consensus and ELO-weighted reputation resolves breaches. No single arbitrator can be bribed or biased.

The 12-state treaty machine captures the full legal lifecycle on-chain: PROPOSED → NEGOTIATING → VALIDATING → ACTIVE → DEGRADING → RENEGOTIATING → BREACHED → CURING → ARBITRATING → RESOLVING → SETTLING → SETTLED. Every state transition is enforced by the smart contract. Every monitoring cycle leaves a Blake3 hash-committed attestation on-chain — an immutable, publicly verifiable audit trail.

## CVI · CVA Integration Points

CONCORD uses **6 of 8** Cleanverse ecosystem capabilities as core protocol infrastructure:

| Capability | Integration Depth |
|-----------|-------------------|
| **CVI** | Identity handshake between counterparties · Tier enforcement (meetsTierRequirement) · Continuous re-verification every 15s monitoring cycle · Hard breach trigger on revocation |
| **CVA** | Asset provenance screening before treaty activation · Sanctions flag detection · Escrow lock/unlock for all financial settlement · Continuous provenance re-verification in monitoring loop |
| **CCP Protocol** | Pre-treaty compliance validation · Pre-amendment compliance check · Pre-settlement compliance verification · ALL compliance delegated to Cleanverse |
| **Clean Payment Rails** | Treaty payments · Escrow funding · Interest distributions · Penalty transfers |
| **Agent Skill Framework** | All 5 dimensions productized as the CONCORD treaty agent |
| **API/SDK** | Every Cleanverse interaction flows through the cooperation API |

**Verification:** All Cleanverse sandbox API endpoints tested and verified (`verify_apass`, `query_apass`, `verify_cva`, `verify_user_compliance`, `query_txs`). Exponential backoff retry with circuit breaker pattern.

## Deployed Chain(s)

| Chain | Status | Contract |
|-------|--------|----------|
| **Monad Testnet** (10143) | ✅ Deployed & live | TreatyContract: `0x55ccE18b8A750cc738841174DFEA0516810CA683` |
| | | ConstitutionRegistry: `0xd75cB676ba68B725C71E4b2948a09bc01Dc77bac` |
| | | MediatorSwarm: `0xA399521120DBA938c769A70e40bb84096270e7c4` |
| Arbitrum Sepolia | ⏳ Architecture ready | Cross-chain treaty bridging in Phase 3 roadmap |

**Architecture supports all 9 Cleanverse chains.** Demo deploys on Monad (400ms blocks, 800ms finality — the only EVM chain fast enough for meaningful 15-second monitoring cycles).

---

## Live Demo

- **Dashboard:** [concord-dashboard-omega.vercel.app](https://concord-dashboard-omega.vercel.app)
- **Agent API:** `curl https://concord-production-6ea8.up.railway.app/status`
- **Demo Video:** [youtu.be/mkpFsPNikuk](https://youtu.be/mkpFsPNikuk)
- **GitHub:** [github.com/Gideon145/concord-protocol](https://github.com/Gideon145/concord-protocol)

3 treaties live on Monad testnet · 15+ natural commits during hacking window · CI pipeline passing · Full whitepaper in repo.

---

**Built in 48 hours. Deployed. Running. Watching.**
