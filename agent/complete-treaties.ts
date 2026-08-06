/**
 * CONCORD Treaty Completion Script
 * Takes any treaties stuck in PROPOSED/NEGOTIATING/VALIDATING and advances them to ACTIVE.
 * Run: npx tsx complete-treaties.ts
 */

import { ethers } from "ethers";

const TREATY_ABI = [
  "function proposeTreaty(address _counterparty, tuple(bytes32 partyACVI, bytes32 partyBCVI, uint8 minTierA, uint8 minTierB, uint256 amount, uint256 interestRate, uint256 duration, uint256 collateralRatio, uint256 liquidationThreshold, uint256 monitoredConditions, uint256 breachGraceBlocks, uint256 renegotiationWindow, uint256 maxRenegotiationRounds, address settlementAsset, uint256 penaltyBps) _terms) external returns (bytes32 treatyId)",
  "function acceptNegotiation(bytes32 treatyId) external",
  "function finalizeNegotiation(bytes32 treatyId) external",
  "function activateTreaty(bytes32 treatyId) external",
  "function getTreatyState(bytes32 treatyId) external view returns (tuple(uint8 state, tuple(bytes32,bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint256) terms, uint256 activatedAt, uint256 lastMonitoredAt, uint256 degradationCount, uint256 renegotiationCount, uint256 breachCount, bytes32 lastAmendmentHash, bytes32 attestationChainRoot, address partyA, address partyB, uint256 escrowBalance, uint256 yieldAccrued, uint256 lastPaymentBlock, uint8 currentBreachTier, uint256 breachStartedAt, bool breachCured))",
  "function getTreatyHealth(bytes32 treatyId) external view returns (uint256 health, string memory status)",
  "function treatyIds(uint256) external view returns (bytes32)",
  "function treatyCount() external view returns (uint256)",
];

const RPC_URL = "http://localhost:8545";
const TREATY_CONTRACT = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";

const RAW_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
];

function findAccount(addr: string): { address: string; key: string } | undefined {
  const lower = addr.toLowerCase();
  return RAW_ACCOUNTS.find(a => a.address.toLowerCase() === lower);
}

const STATE_NAMES = ["PROPOSED","NEGOTIATING","VALIDATING","ACTIVE","DEGRADING",
                     "RENEGOTIATING","BREACHED","CURING","ARBITRATING","RESOLVING",
                     "SETTLING","SETTLED","TERMINATED"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const agentAcct = findAccount("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")!;
  const agentWallet = new ethers.Wallet(agentAcct.key, provider);
  const treaty = new ethers.Contract(TREATY_CONTRACT, TREATY_ABI, agentWallet);

  const count = Number(await treaty.treatyCount());
  console.log(`Found ${count} treaties\n`);

  if (count === 0) {
    console.log("No treaties to process. Run seed-treaties.ts first.");
    return;
  }

  // Process each treaty
  for (let i = 0; i < count; i++) {
    const id = await treaty.treatyIds(i);
    const state = await treaty.getTreatyState(id);
    const stateNum = Number(state.state);
    const stateName = STATE_NAMES[stateNum];
    const partyA = state.partyA;
    const partyB = state.partyB;

    console.log(`Treaty #${i}: ${id.slice(0, 14)}… ${stateName}`);
    console.log(`  Party A: ${partyA.slice(0, 10)}… Party B: ${partyB.slice(0, 10)}…`);

    let agentNonce = await provider.getTransactionCount(agentWallet.address, "pending");

    // Step 1: PROPOSED → NEGOTIATING (accept)
    if (stateNum === 0) {
      console.log(`  ⏳ Needs acceptance by Party B...`);
      const partyBKey = findAccount(partyB)?.key;
      if (!partyBKey) {
        console.log(`  ⚠ No key for Party B ${partyB} — skipping`);
        continue;
      }
      const partyBWallet = new ethers.Wallet(partyBKey, provider);
      const partyBTreaty = new ethers.Contract(TREATY_CONTRACT, TREATY_ABI, partyBWallet);
      const nonce = await provider.getTransactionCount(partyB, "pending");
      const tx = await partyBTreaty.acceptNegotiation(id, { nonce });
      await tx.wait();
      console.log(`  ✅ Accepted (PROPOSED → NEGOTIATING)`);
    }

    // Step 2: NEGOTIATING → VALIDATING (finalize)
    if (stateNum <= 1) {
      console.log(`  ⏳ Finalizing...`);
      agentNonce = await provider.getTransactionCount(agentWallet.address, "pending");
      const tx = await treaty.finalizeNegotiation(id, { nonce: agentNonce });
      await tx.wait();
      console.log(`  ✅ Finalized (NEGOTIATING → VALIDATING)`);
    }

    // Step 3: VALIDATING → ACTIVE
    if (stateNum <= 2) {
      console.log(`  ⏳ Activating...`);
      agentNonce = await provider.getTransactionCount(agentWallet.address, "pending");
      const tx = await treaty.activateTreaty(id, { nonce: agentNonce });
      await tx.wait();
      console.log(`  ✅ Activated (VALIDATING → ACTIVE)`);
    }

    if (stateNum === 3) {
      console.log(`  ✅ Already ACTIVE`);
    } else if (stateNum > 3) {
      console.log(`  ℹ Already in ${stateName}`);
    }

    console.log();
  }

  // Final summary
  console.log("── Final State ──\n");
  for (let i = 0; i < count; i++) {
    const id = await treaty.treatyIds(i);
    const state = await treaty.getTreatyState(id);
    const health = await treaty.getTreatyHealth(id);
    console.log(`  #${i}: ${id.slice(0, 14)}… ${STATE_NAMES[Number(state.state)]} health=${health.health} "${health.status}"`);
  }
  console.log("\n🎉 All treaties advanced!");
}

main().catch(console.error);
