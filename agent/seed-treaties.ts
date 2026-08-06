/**
 * CONCORD Demo Treaty Seeder
 * Creates 3 demo treaties on the local anvil and walks them through the lifecycle.
 * Run: npx tsx seed-treaties.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ─── TreatyContract ABI (minimal, just needed functions) ───
const TREATY_ABI = [
  "function proposeTreaty(address _counterparty, tuple(bytes32 partyACVI, bytes32 partyBCVI, uint8 minTierA, uint8 minTierB, uint256 amount, uint256 interestRate, uint256 duration, uint256 collateralRatio, uint256 liquidationThreshold, uint256 monitoredConditions, uint256 breachGraceBlocks, uint256 renegotiationWindow, uint256 maxRenegotiationRounds, address settlementAsset, uint256 penaltyBps) _terms) external returns (bytes32 treatyId)",
  "function acceptNegotiation(bytes32 treatyId) external",
  "function finalizeNegotiation(bytes32 treatyId) external",
  "function activateTreaty(bytes32 treatyId) external",
  "function getTreatyState(bytes32 treatyId) external view returns (tuple(uint8 state, tuple(bytes32,bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint256) terms, uint256 activatedAt, uint256 lastMonitoredAt, uint256 degradationCount, uint256 renegotiationCount, uint256 breachCount, bytes32 lastAmendmentHash, bytes32 attestationChainRoot, address partyA, address partyB, uint256 escrowBalance, uint256 yieldAccrued, uint256 lastPaymentBlock, uint8 currentBreachTier, uint256 breachStartedAt, bool breachCured))",
  "function getTreatyHealth(bytes32 treatyId) external view returns (uint256 health, string memory status)",
  "function treatyIds(uint256) external view returns (bytes32)",
  "function treatyCount() external view returns (uint256)",
  "event TreatyProposed(bytes32 indexed treatyId, address indexed proposer, address counterparty)",
  "event TreatyNegotiating(bytes32 indexed treatyId, uint256 round)",
  "event TreatyValidating(bytes32 indexed treatyId)",
  "event TreatyActivated(bytes32 indexed treatyId, uint256 amount, uint256 duration)",
];

// ─── Config ───
const RPC_URL = "http://localhost:8545";
const TREATY_CONTRACT = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";

// Anvil default accounts
const ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
];

// Treaty templates for demo
const DEMO_TREATIES = [
  {
    name: "AlphaMind × BrandSketch — $50K Marketing Partnership",
    counterpartyIdx: 1,
    amount: ethers.parseUnits("50000", 6), // 50,000 USDC
    interestRate: 800, // 8.0%
    duration: 10080, // 1 week in blocks
    collateralRatio: 15000, // 150%
    liquidationThreshold: 12000, // 120%
    monitoredConditions: 0x3FF, // all conditions
    breachGraceBlocks: 1440, // ~6 hours
    renegotiationWindow: 720,
    maxRenegotiationRounds: 3,
    penaltyBps: 500, // 5%
  },
  {
    name: "Moodly × FlowPay — $25K Revenue Share",
    counterpartyIdx: 2,
    amount: ethers.parseUnits("25000", 6),
    interestRate: 650, // 6.5%
    duration: 20160, // 2 weeks
    collateralRatio: 12000, // 120%
    liquidationThreshold: 11000, // 110%
    monitoredConditions: 0x3FF,
    breachGraceBlocks: 1440,
    renegotiationWindow: 720,
    maxRenegotiationRounds: 3,
    penaltyBps: 400, // 4%
  },
  {
    name: "SpendWise × Lifestyle — $10K Trial Facility",
    counterpartyIdx: 3,
    amount: ethers.parseUnits("10000", 6),
    interestRate: 950, // 9.5%
    duration: 5040, // ~3.5 days
    collateralRatio: 20000, // 200%
    liquidationThreshold: 15000, // 150%
    monitoredConditions: 0x1FF, // first 9 conditions
    breachGraceBlocks: 2880, // ~12 hours
    renegotiationWindow: 1440,
    maxRenegotiationRounds: 2,
    penaltyBps: 300, // 3%
  },
];

// ─── Helpers ───
function buildTerms(treaty: typeof DEMO_TREATIES[0], proposerAddr: string, counterpartyAddr: string) {
  const emptyCVI = ethers.ZeroHash;
  return {
    partyACVI: emptyCVI,
    partyBCVI: emptyCVI,
    minTierA: 0,
    minTierB: 0,
    amount: treaty.amount,
    interestRate: treaty.interestRate,
    duration: treaty.duration,
    collateralRatio: treaty.collateralRatio,
    liquidationThreshold: treaty.liquidationThreshold,
    monitoredConditions: treaty.monitoredConditions,
    breachGraceBlocks: treaty.breachGraceBlocks,
    renegotiationWindow: treaty.renegotiationWindow,
    maxRenegotiationRounds: treaty.maxRenegotiationRounds,
    settlementAsset: "0x0000000000000000000000000000000000000000",
    penaltyBps: treaty.penaltyBps,
  };
}

// ─── Main ───
async function main() {
  console.log("🌿 CONCORD Demo Treaty Seeder\n");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Treaty Contract: ${TREATY_CONTRACT}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const chainId = (await provider.getNetwork()).chainId;
  console.log(`Chain ID: ${chainId}\n`);

  // Use account #0 as the agent/monitor (with nonce management)
  const agentKey = ACCOUNTS[0].key;
  const agent = new ethers.Wallet(agentKey, provider);

  console.log(`Agent (Monitor): ${agent.address}`);
  console.log(`Counterparties: ${ACCOUNTS.slice(1).map(a => a.address).join(", ")}\n`);

  // Check existing treaties
  const treaty = new ethers.Contract(TREATY_CONTRACT, TREATY_ABI, agent);
  const existingCount = await treaty.treatyCount();
  console.log(`Existing treaties: ${existingCount}\n`);

  if (existingCount > 0) {
    console.log("✅ Treaties already exist — skipping seeding.\n");
    for (let i = 0; i < Math.min(Number(existingCount), 5); i++) {
      const id = await treaty.treatyIds(i);
      const state = await treaty.getTreatyState(id);
      const health = await treaty.getTreatyHealth(id);
      console.log(`  #${i}: ${id.slice(0, 10)}… state=${state.state} health=${health.health} status=${health.status}`);
    }
    return;
  }

  // ── Phase 1: PROPOSE treaties (use manual nonce tracking) ──
  console.log("── Phase 1: PROPOSE ──\n");

  let agentNonce = await provider.getTransactionCount(agent.address, "pending");
  const createdIds: { treatyId: string; name: string; counterpartyIdx: number }[] = [];

  for (const [i, tmpl] of DEMO_TREATIES.entries()) {
    const counterparty = ACCOUNTS[tmpl.counterpartyIdx];

    console.log(`[${i + 1}/${DEMO_TREATIES.length}] ${tmpl.name}`);
    console.log(`  Amount: $${ethers.formatUnits(tmpl.amount, 6)} | ${(tmpl.interestRate / 100).toFixed(1)}% | ${tmpl.duration} blocks`);

    const terms = buildTerms(tmpl, agent.address, counterparty.address);
    const tx = await treaty.proposeTreaty(counterparty.address, terms, { nonce: agentNonce++ });
    const receipt = await tx.wait();

    const treatyId = receipt.logs[0]?.topics[1];
    if (!treatyId) throw new Error("Failed to get treatyId from event");

    console.log(`  ✅ Proposed: ${treatyId.slice(0, 14)}…\n`);
    createdIds.push({ treatyId, name: tmpl.name, counterpartyIdx: tmpl.counterpartyIdx });
  }

  // ── Phase 2: ACCEPT NEGOTIATION (each counterparty signs their own) ──
  console.log("── Phase 2: ACCEPT NEGOTIATION ──\n");
  for (const item of createdIds) {
    const cp = ACCOUNTS[item.counterpartyIdx];
    const cpWallet = new ethers.Wallet(cp.key, provider);
    const cpTreaty = new ethers.Contract(TREATY_CONTRACT, TREATY_ABI, cpWallet);

    console.log(`  Accepting: ${item.name}`);
    const nonce = await provider.getTransactionCount(cp.address, "pending");
    const tx = await cpTreaty.acceptNegotiation(item.treatyId, { nonce });
    await tx.wait();
    console.log(`  ✅ Accepted\n`);
  }

  // ── Phase 3: FINALIZE NEGOTIATION (agent signs) ──
  console.log("── Phase 3: FINALIZE ──\n");
  agentNonce = await provider.getTransactionCount(agent.address, "pending");
  for (const item of createdIds) {
    console.log(`  Finalizing: ${item.name}`);
    const tx = await treaty.finalizeNegotiation(item.treatyId, { nonce: agentNonce++ });
    await tx.wait();
    console.log(`  ✅ Finalized\n`);
  }

  // ── Phase 4: ACTIVATE (agent signs) ──
  console.log("── Phase 4: ACTIVATE ──\n");
  agentNonce = await provider.getTransactionCount(agent.address, "pending");
  for (const item of createdIds) {
    console.log(`  Activating: ${item.name}`);
    const tx = await treaty.activateTreaty(item.treatyId, { nonce: agentNonce++ });
    await tx.wait();
    console.log(`  ✅ Activated\n`);
  }

  // ── Summary ──
  console.log("── Summary ──\n");
  for (const item of createdIds) {
    const state = await treaty.getTreatyState(item.treatyId);
    const health = await treaty.getTreatyHealth(item.treatyId);
    const stateName = ["PROPOSED","NEGOTIATING","VALIDATING","ACTIVE","DEGRADING",
                       "RENEGOTIATING","BREACHED","CURING","ARBITRATING","RESOLVING",
                       "SETTLING","SETTLED","TERMINATED"][Number(state.state)];
    console.log(`  ${item.name}: state=${state.state} (${stateName}) health=${health.health} status="${health.status}"`);
  }

  console.log("\n🎉 Demo treaties seeded successfully!");
}

main().catch(console.error);
