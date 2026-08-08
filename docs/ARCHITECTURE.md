# CONCORD Architecture

## Overview

CONCORD is a three-layer protocol for autonomous AI-to-AI economic relationships. Two agents — each with Cleanverse CVI identity and on-chain constitutional rules — form, monitor, renegotiate, and settle bilateral financial agreements without human intervention.

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│         Next.js 14 Mission Control Dashboard     │
│    Real-time treaty monitoring & state machine   │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (polling every 2s)
┌──────────────────▼──────────────────────────────┐
│              Agent Service                       │
│         TypeScript / Node.js / Express           │
│    ┌──────────────────────────────────────┐      │
│    │  Treaty Monitor (15s autonomous loop) │      │
│    │  └─ 10-condition evaluation           │      │
│    │  └─ Cleanverse CVI/CVA/CCP checks     │      │
│    │  └─ Attestation recording on-chain    │      │
│    ├──────────────────────────────────────┤      │
│    │  Negotiation Engine                   │      │
│    │  └─ Autonomous term proposal          │      │
│    │  └─ Mediator Swarm consensus          │      │
│    │  └─ Constitutional rule validation    │      │
│    └──────────────────────────────────────┘      │
└──────────────────┬──────────────────────────────┘
                   │ ethers.js v6 (RPC)
┌──────────────────▼──────────────────────────────┐
│             Smart Contracts (Solidity)            │
│    ┌──────────────────────────────────────┐      │
│    │  TreatyContract (12-state FSM)        │      │
│    │  PROPOSED → NEGOTIATING → VALIDATING  │      │
│    │  → ACTIVE → DEGRADING → RENEGOTIATING │      │
│    │  → BREACHED → CURING → ARBITRATING    │      │
│    │  → RESOLVING → SETTLING → SETTLED     │      │
│    ├──────────────────────────────────────┤      │
│    │  ConstitutionRegistry                 │      │
│    │  └─ Immutable agent rules             │      │
│    │  └─ Treaty term validation            │      │
│    │  └─ Tier requirement enforcement      │      │
│    ├──────────────────────────────────────┤      │
│    │  MediatorSwarm                        │      │
│    │  └─ 3-agent consensus (2/3 required)  │      │
│    │  └─ ELO reputation tracking           │      │
│    │  └─ Fairness scoring                  │      │
│    └──────────────────────────────────────┘      │
│              Deployed on Monad Testnet           │
└──────────────────────────────────────────────────┘
```

## State Machine

The TreatyContract implements a 12-state finite state machine:

| Phase | States | Description |
|-------|--------|-------------|
| Formation | PROPOSED (0) → NEGOTIATING (1) → VALIDATING (2) | Treaty creation and identity verification |
| Active Operations | ACTIVE (3) → DEGRADING (4) → RENEGOTIATING (5) | Live monitoring with automated adaptation |
| Breach Response | BREACHED (6) → CURING (7) → ARBITRATING (8) | Violation detection and dispute resolution |
| Resolution | RESOLVING (9) → SETTLING (10) → SETTLED (11) / TERMINATED (12) | Final settlement execution |

## Monitoring Conditions (10 total)

### Hard Conditions (breach triggers)
1. CVI Status — Party A
2. CVI Status — Party B
3. CVA Asset Provenance
4. Collateral Ratio
5. Payment Default

### Soft Conditions (degradation triggers)
6. Collateral Buffer Approaching Threshold
7. Yield Performance on Target
8. Counterparty Health
9. Oracle Deviation
10. Liquidity Adequacy
11. Milestone Delivery

## Cleanverse Integration

CONCORD uses three Cleanverse primitives:

- **CVI (Credential Verification Interface)** — Agent identity verification via A-Pass
- **CVA (Credential Verification for Assets)** — Asset provenance and sanctions screening
- **CCP (Cross-Chain Compliance Protocol)** — Treaty compliance validation

## Deployment

| Environment | Chain | Contracts |
|-------------|-------|-----------|
| Production (Monad Testnet) | 10143 | Treaty: `0x55ccE18b...`, Constitution: `0xd75cB676...`, Mediator: `0xA3995211...` |
| Development (Anvil) | 31337 | Local deployment via `forge script` |
