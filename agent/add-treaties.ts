/**
 * CONCORD — Add more demo treaties
 * Run: npx tsx add-treaties.ts
 */
import { ethers } from "ethers";

const TREATY_ABI = [
  "function proposeTreaty(address _counterparty, tuple(bytes32 partyACVI, bytes32 partyBCVI, uint8 minTierA, uint8 minTierB, uint256 amount, uint256 interestRate, uint256 duration, uint256 collateralRatio, uint256 liquidationThreshold, uint256 monitoredConditions, uint256 breachGraceBlocks, uint256 renegotiationWindow, uint256 maxRenegotiationRounds, address settlementAsset, uint256 penaltyBps) _terms) external returns (bytes32 treatyId)",
  "function acceptNegotiation(bytes32 treatyId) external",
  "function finalizeNegotiation(bytes32 treatyId) external",
  "function activateTreaty(bytes32 treatyId) external",
  "function getTreatyState(bytes32 treatyId) external view returns (tuple(uint8 state, tuple(bytes32,bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint256) terms, uint256 activatedAt, uint256 lastMonitoredAt, uint256 degradationCount, uint256 renegotiationCount, uint256 breachCount, bytes32 lastAmendmentHash, bytes32 attestationChainRoot, address partyA, address partyB, uint256 escrowBalance, uint256 yieldAccrued, uint256 lastPaymentBlock, uint8 currentBreachTier, uint256 breachStartedAt, bool breachCured))",
  "function treatyIds(uint256) external view returns (bytes32)",
  "function treatyCount() external view returns (uint256)",
];

const RPC = "http://localhost:8545";
const CONTRACT = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";

const ACCTS = [
  { addr: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
];

async function getNonce(provider: ethers.JsonRpcProvider, addr: string): Promise<number> {
  return await provider.getTransactionCount(addr, "latest");
}

async function proposeAndActivate(
  provider: ethers.JsonRpcProvider,
  agentKey: string,
  counterpartyIdx: number,
  amount: bigint,
  interestRate: number,
  duration: number,
  collatRatio: number,
  liqThreshold: number,
) {
  const agent = new ethers.Wallet(agentKey, provider);
  const treaty = new ethers.Contract(CONTRACT, TREATY_ABI, agent);
  const cp = ACCTS[counterpartyIdx];

  const terms = {
    partyACVI: ethers.ZeroHash, partyBCVI: ethers.ZeroHash,
    minTierA: 0, minTierB: 0,
    amount, interestRate, duration,
    collateralRatio: collatRatio, liquidationThreshold: liqThreshold,
    monitoredConditions: 0x3FF,
    breachGraceBlocks: 1440, renegotiationWindow: 720,
    maxRenegotiationRounds: 3,
    settlementAsset: "0x0000000000000000000000000000000000000000",
    penaltyBps: 500,
  };

  // Propose
  const tx1 = await treaty.proposeTreaty(cp.addr, terms, { nonce: await getNonce(provider, agent.address) });
  const receipt = await tx1.wait();
  const treatyId = receipt.logs[0]?.topics[1]!;
  console.log(`  Proposed: ${treatyId.slice(0, 14)}…`);

  // Accept (as counterparty)
  const cpWallet = new ethers.Wallet(cp.key, provider);
  const cpTreaty = new ethers.Contract(CONTRACT, TREATY_ABI, cpWallet);
  await cpTreaty.acceptNegotiation(treatyId, { nonce: await getNonce(provider, cp.addr) });
  await tx1.wait(); // ensure mined
  console.log(`  Accepted`);

  // Finalize
  const txF = await treaty.finalizeNegotiation(treatyId, { nonce: await getNonce(provider, agent.address) });
  await txF.wait();
  console.log(`  Finalized`);

  // Activate
  const txA = await treaty.activateTreaty(treatyId, { nonce: await getNonce(provider, agent.address) });
  await txA.wait();
  console.log(`  Activated`);
  console.log();
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const agentKey = ACCTS[0].key;
  const treaty = new ethers.Contract(CONTRACT, TREATY_ABI, new ethers.Wallet(agentKey, provider));

  const existing = Number(await treaty.treatyCount());
  console.log(`Existing: ${existing} treaties\n`);
  
  if (existing >= 3) {
    console.log("Already have 3+ treaties. Skipping.");
    return;
  }

  // Treaty #2: Moodly × FlowPay
  console.log("[2/3] Moodly × FlowPay — $25K Revenue Share");
  await proposeAndActivate(
    provider, agentKey, 2, // counterparty index 2
    ethers.parseUnits("25000", 6), // $25,000
    650, 20160, 12000, 11000
  );

  // Treaty #3: SpendWise × Lifestyle
  console.log("[3/3] SpendWise × Lifestyle — $10K Trial Facility");
  await proposeAndActivate(
    provider, agentKey, 1, // counterparty index 1 (reuse)
    ethers.parseUnits("10000", 6), // $10,000
    950, 5040, 20000, 15000
  );

  console.log("── Final ──");
  const final = Number(await treaty.treatyCount());
  for (let i = 0; i < final; i++) {
    const id = await treaty.treatyIds(i);
    const s = await treaty.getTreatyState(id);
    console.log(`  #${i}: ${id.slice(0, 14)}… state=${s.state}`);
  }
  console.log("\n🎉 3 treaties seeded!");
}

main().catch(console.error);
