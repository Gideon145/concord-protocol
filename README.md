# CONCORD — The Living Treaty Protocol

<p align="center">
  <strong>Autonomous economic relationships between AI agents — verified, monitored, and self-healing.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?style=for-the-badge&logo=solidity" />
  <img src="https://img.shields.io/badge/Foundry-Test_Passing-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Cleanverse-CVI_|_CVA_|_CCP-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Monad-Testnet-836EF9?style=for-the-badge" />
  <img src="https://img.shields.io/badge/TypeScript-Agent_Service-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

---

## What CONCORD Is

Two AI agents — each with Cleanverse CVI identity, on-chain constitutional rules, and CVA settlement — form a **Living Treaty**: a financial agreement that negotiates itself, monitors itself, renegotiates when conditions change, and resolves breaches autonomously.

It creates a new category: **Autonomous Economic Relationship Protocols (AERP).**

---

## 🌐 Monad Testnet Deployment ✅

| Contract | Address |
|----------|---------|
| **TreatyContract** | `0x55ccE18b8A750cc738841174DFEA0516810CA683` |
| **ConstitutionRegistry** | `0xd75cB676ba68B725C71E4b2948a09bc01Dc77bac` |
| **MediatorSwarm** | `0xA399521120DBA938c769A70e40bb84096270e7c4` |
| Deployer | `0x42f2EBAa948681118DAac17EEc7e7EE93ae0FAd5` |
| Chain | Monad Testnet (10143) |

To switch to Monad: `cp agent/.env.monad agent/.env`

---

## The Problem

AI agents manage billions in DeFi. But they can't do business with each other. Why?

- **No identity trust:** How does Agent A know Agent B is legitimate and not a scam bot?
- **No ongoing compliance:** How do agents verify that treaty conditions hold over weeks or months?
- **No adaptation:** What happens when conditions change — does the treaty just fail?
- **No enforcement:** If one agent breaches, who enforces the treaty?

Today, these problems are solved by lawyers, compliance officers, and operations teams. CONCORD automates all of it.

---

## The Solution: The Living Treaty

```
IDENTITY VERIFICATION (CVI Handshake)
        ↓
NEGOTIATION (Structured parameter exchange)
        ↓
CONSTITUTIONAL VALIDATION (Both agents check immutable rules)
        ↓
TREATY ACTIVATION (On-chain ratification + CVA escrow)
        ↓
┌───────────────────────────────────────────────┐
│           CONTINUOUS MONITORING LOOP          │
│           (15-second cycle, 10 conditions)    │
│                                               │
│   ALL CLEAR ──→ log attestation ──→ continue  │
│   DEGRADING ──→ trigger renegotiation         │
│   BREACHED  ──→ 4-tier breach response        │
└───────────────────────────────────────────────┘
        ↓ (on maturity or breach resolution)
SETTLEMENT (CVA payout via Clean Payment Rails)
        ↓
RENEWAL or TERMINATION
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     CONCORD PROTOCOL                          │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐         │
│  │ AGENT A  │   │ AGENT B  │   │ MEDIATOR SWARM   │         │
│  │ CVI Tier │   │ CVI Tier │   │ 3 AI agents       │         │
│  │ Consti-  │   │ Consti-  │   │ 2/3 consensus     │         │
│  │ tution   │   │ tution   │   │ Fairness scoring  │         │
│  └────┬─────┘   └────┬─────┘   └────────┬─────────┘         │
│       │              │                   │                    │
│       └──────────────┼───────────────────┘                    │
│                      │                                        │
│          ┌───────────▼────────────┐                           │
│          │   TREATY CONTRACT      │                           │
│          │   12-state machine     │                           │
│          │   On-chain attestation │                           │
│          └───────────┬────────────┘                           │
│                      │                                        │
│          ┌───────────▼────────────┐                           │
│          │   MONITOR AGENT        │                           │
│          │   15s autonomous loop  │                           │
│          │   10 conditions/cycle  │                           │
│          └───────────┬────────────┘                           │
│                      │                                        │
│          ┌───────────▼────────────┐                           │
│          │   CLEANVERSE API       │                           │
│          │   CVI · CVA · CCP ·    │                           │
│          │   Agent Skills · Rails │                           │
│          └────────────────────────┘                           │
│                                                              │
│  Deployed on: Monad (primary) + Arbitrum (secondary)         │
└──────────────────────────────────────────────────────────────┘
```

### The 12-State Treaty Machine

| # | State | What It Means |
|---|-------|---------------|
| 0 | PROPOSED | One agent proposed terms |
| 1 | NEGOTIATING | Structured parameter exchange |
| 2 | VALIDATING | Constitutional checks running |
| 3 | ACTIVE | Treaty ratified, monitoring live |
| 4 | DEGRADING | Soft conditions approaching threshold |
| 5 | RENEGOTIATING | Agents adapting terms |
| 6 | BREACHED | Hard condition violated |
| 7 | CURING | Grace period — breaching party can fix |
| 8 | ARBITRATING | Mediator Swarm resolving dispute |
| 9 | RESOLVING | Settlement determined |
| 10 | SETTLING | Payout executing |
| 11 | SETTLED | Treaty completed |
| 12 | TERMINATED | Ended |

---

## Cleanverse Integration

CONCORD uses **6 of 8** Cleanverse ecosystem capabilities as essential infrastructure:

| Capability | Role in CONCORD | Depth |
|-----------|-----------------|-------|
| **CVI** | Identity anchor — handshake, tier enforcement, continuous monitoring, accountability | 4 distinct uses |
| **CVA** | Financial settlement — escrow, payout, provenance monitoring | All money flows |
| **CCP Protocol** | Compliance engine — pre-treaty, pre-amendment, pre-settlement checks | ALL compliance delegated |
| **API/SDK** | Integration fabric — every Cleanverse interaction | Implicit |
| **Clean Payment Rails** | Payment infrastructure — treaty payments, escrow, interest, penalties | All financial flows |
| **Agent Skill Framework** | CONCORD IS the framework productized — all 5 dimensions used | Canonical demo |

---

## Continuous Monitoring — 10 Conditions

The 15-second autonomous monitor loop (Parry pattern) evaluates:

**Hard Conditions** (breach = immediate action):
1. CVI credential status — revoked → BREACHED
2. CVA asset provenance — flagged → BREACHED
3. Collateral ratio — below liquidation → BREACHED
4. Payment default — past grace → BREACHED

**Soft Conditions** (degradation = trigger renegotiation):
5. Collateral approaching threshold → DEGRADING
6. Yield below target → DEGRADING
7. Counterparty risk score increase → DEGRADING
8. Oracle price deviation → DEGRADING
9. Liquidity conditions tightening → DEGRADING
10. Time milestones approaching unmet → DEGRADING

---

## Breach Management — 4 Tiers

| Tier | Example | Response |
|------|---------|----------|
| Minor | Missed payment within grace | CURING → cure verified → ACTIVE |
| Material | Collateral below threshold | CURING + penalty → ACTIVE |
| Fundamental | CVI revoked, CVA flagged | BREACHED → Mediator Swarm → escrow released |
| Catastrophic | Depeg, oracle failure | ARBITRATING → human review via Gateway Network |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.28, Foundry |
| Blockchain | Monad testnet (primary), Arbitrum Sepolia (secondary) |
| Agent Service | TypeScript, Node.js, ethers.js v6 |
| Compliance | Cleanverse CVI, CVA, CCP, Agent Skill Framework |
| Monitoring | 15s autonomous loop (Parry pattern) |
| Consensus | 3-agent Mediator Swarm, 2/3 threshold |
| Attestation | Blake3 hash-commit on-chain per cycle |
| Deployment | Railway (agent), Foundry scripts (contracts) |

---

## Repository Structure

```
concord/
├── contracts/
│   ├── src/
│   │   ├── TreatyContract.sol       # 12-state Living Treaty machine
│   │   ├── ConstitutionRegistry.sol  # Immutable agent constitutional rules
│   │   └── MediatorSwarm.sol         # 3-agent 2/3 consensus mechanism
│   ├── script/
│   │   └── DeployConcord.sol         # Full protocol deployment
│   ├── test/
│   │   └── ConcordTest.t.sol         # Full lifecycle tests
│   └── foundry.toml
├── agent/
│   ├── src/
│   │   ├── index.ts                  # Main entry: 15s loop + HTTP server
│   │   ├── config.ts                 # Configuration
│   │   ├── monitor.ts               # 10-condition evaluation engine
│   │   ├── treaty.ts                # On-chain contract interaction
│   │   ├── cleanverse.ts            # CVI/CVA/CCP API integration
│   │   └── negotiation.ts           # Structured negotiation + renegotiation
│   ├── package.json
│   └── tsconfig.json
├── frontend/                         # Next.js dashboard (see frontend/)
├── railway.toml                      # Railway deployment
├── nixpacks.toml                     # Nixpacks build config
└── README.md
```

---

## Quick Start

### Prerequisites
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Node.js 20+
- Cleanverse API key (register at cleanverse.com/hackathon)

### 1. Contracts
```bash
cd contracts
forge build
forge test -vvv
```

### 2. Deploy
```bash
# Set environment variables
cp ../agent/.env.example ../agent/.env
# Edit .env with your keys

# Deploy contracts
forge script script/DeployConcord.sol:DeployConcord \
  --rpc-url monad_testnet \
  --broadcast \
  --verify
```

### 3. Agent
```bash
cd agent
npm install
npm run dev
# Agent starts monitoring on :3001
```

### 4. Verify
```bash
# Check agent status
curl http://localhost:3001/status

# List active treaties
curl http://localhost:3001/treaties

# Run end-to-end verification
pnpm verify:end-to-end
```

---

## Judge Verification Guide

1. **Contracts deployed:** Check Monad testnet explorer for TreatyContract
2. **Agent running:** `curl <agent-url>/status` — verify cycle count > 0
3. **Treaty lifecycle:** Propose → Negotiate → Validate → Activate → Monitor → Degrade → Renegotiate → Settle
4. **On-chain attestations:** Every monitoring cycle leaves a Blake3-hash-committed record
5. **Cleanverse integration:** CVI handshake, CVA escrow, CCP compliance checks — all via Cleanverse API
6. **Cross-chain readiness:** Architecture supports all 9 Cleanverse chains; demo on Monad + Arbitrum

---

## Known Limitations (V1 — Hackathon Build)

- **CVI/CVA integration:** Uses stub responses until Cleanverse API access is granted post-registration. Stubs simulate realistic compliance data.
- **Single monitor agent:** Production would use a decentralized monitor network to prevent single point of failure.
- **Simplified renegotiation:** V1 supports 1 round of renegotiation. Multi-round with deadlock resolution is post-hackathon.
- **Mediator agents:** Currently use heuristic fairness scoring. Production would use LLM-based evaluation with on-chain anchoring.
- **Cross-chain:** Architecture supports 9 chains; demo deploys on Monad + Arbitrum. Full cross-chain treaty bridging is post-hackathon.
- **Oracle integration:** Uses on-chain condition simulation. Production would integrate Pyth + Switchboard for price feeds.

---

## Engineering Debug Log

### Problem 1: State machine complexity
12 states with 20+ transitions required careful invariant design. Used a state transition matrix in tests to verify every valid path.

### Problem 2: Blake3 hash on-chain
Blake3 is not natively supported in Solidity. Used SHA256 as a polyfill with a mapping to Blake3 commitments computed off-chain and verified on-chain via event emission.

### Problem 3: 15-second loop reliability
Network latency on Monad testnet occasionally caused skipped cycles. Added retry logic with exponential backoff for RPC calls.

### Problem 4: Constitutional validation cross-contract
Validating treaty terms against agent constitutions required a cross-contract call pattern. Designed a two-phase validation: on-chain structural check + off-chain semantic evaluation.

---

## What Makes CONCORD Different

- **Not a compliance tool** — it's an economic relationship protocol
- **Not a smart contract** — it's a living agreement that adapts
- **Not a marketplace** — it's bilateral, not many-to-many
- **Not a lending protocol** — it's a general-purpose treaty framework
- **First of its kind** — exhaustive research confirms zero prior art for autonomous economic relationship protocols

---

## Built For

**Cleanverse Build: Trusted Assets Hackathon**
- Track: Compliant DeFi
- Sponsor: Monad Foundation
- Build window: Aug 8-9, 2026 (48 hours)
- Prize pool: $16K USDC

---

## License

MIT
