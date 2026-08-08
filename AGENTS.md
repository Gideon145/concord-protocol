# AGENTS.md — CONCORD Protocol

## Project Identity
- **Name:** CONCORD — Living Treaty Protocol
- **Category:** Autonomous Economic Relationship Protocol (AERP)
- **Chain:** Monad Testnet (10143)
- **Stack:** Solidity 0.8.28 + TypeScript + Next.js 14
- **Cleanverse Primitives:** CVI, CVA, CCP

## What We're Building
Autonomous AI-to-AI economic treaties. Two agents with Cleanverse identity form, monitor, renegotiate, and settle financial agreements — all on-chain, zero human intervention.

## Repository Map
```
contracts/     → Solidity (Foundry): TreatyContract, ConstitutionRegistry, MediatorSwarm
agent/         → TypeScript monitor service: 15s loop, 10-condition eval, Cleanverse API
frontend/      → Next.js 14 dashboard: real-time treaty monitoring
docs/          → Architecture, whitepaper, deployment guides
.github/       → CI workflow (Foundry + TypeScript + Next.js)
```

## Development Commands
```bash
# Contracts
cd contracts && forge build && forge test

# Agent
cd agent && npm run dev          # tsx src/index.ts (watch mode)
cd agent && npx tsx setup-demo.ts  # seed 3 treaties on anvil

# Frontend
cd frontend && npm run dev       # next dev -p 3000

# Full local stack
# Terminal 1: anvil --block-time 2
# Terminal 2: cd contracts && forge script script/DeployConcord.sol --rpc-url http://localhost:8545 --broadcast
# Terminal 3: cd agent && npx tsx setup-demo.ts && npm run dev
# Terminal 4: cd frontend && npm run dev
```

## Deployment
- **Frontend:** Vercel (concord-dashboard-omega.vercel.app)
- **Agent:** Railway (concord-production-6ea8.up.railway.app)
- **Contracts:** Monad Testnet (see docs/ARCHITECTURE.md for addresses)

## Commit Style
- Short, specific first lines
- Mention what changed AND why
- No generic messages
- Reference issue numbers when applicable
