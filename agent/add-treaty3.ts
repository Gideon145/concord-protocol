import { ethers } from "ethers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreatyArtifact = require("./src/abis/TreatyContract.json");

const p = new ethers.JsonRpcProvider("http://localhost:8545");
const w = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", p);
const c = new ethers.Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", TreatyArtifact.abi, w);
const cp = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function main() {
  const existing = await c.treatyCount();
  console.log(`Existing treaties: ${existing}`);

  if (existing >= 3) {
    console.log("Already have 3+ treaties. Checking states...");
    for (let i = 0; i < existing; i++) {
      const id = await c.treatyIds(i);
      const st = await c.getTreatyState(id);
      console.log(`  #${i}: ${id.slice(0,14)}... state=${st.state}`);
    }
    return;
  }

  const t = {
    partyACVI: ethers.ZeroHash, partyBCVI: ethers.ZeroHash,
    minTierA: 0, minTierB: 0,
    amount: ethers.parseUnits("50000", 6),
    interestRate: 800, duration: 10080n,
    collateralRatio: 15000, liquidationThreshold: 12000,
    monitoredConditions: 0x3FFn,
    breachGraceBlocks: 1440n, renegotiationWindow: 720n,
    maxRenegotiationRounds: 3,
    settlementAsset: "0x0000000000000000000000000000000000000000",
    penaltyBps: 500,
  };

  // Get treatyId first via static call
  const id = await c.proposeTreaty.staticCall(cp, t, { from: w.address });
  console.log(`Treaty ID: ${id.slice(0,14)}...`);

  // Send the actual transaction
  const r1 = await c.proposeTreaty(cp, t, { nonce: await p.getTransactionCount(w.address, "latest") });
  await r1.wait();
  console.log(`Proposed: ${id.slice(0,14)}... (AlphaMind x BrandSketch $50K)`);

  const cpW = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", p);
  const cpC = new ethers.Contract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", TreatyArtifact.abi, cpW);
  const aTx = await cpC.acceptNegotiation(id, { nonce: await p.getTransactionCount(cp, "latest") });
  await aTx.wait();
  console.log("Accepted");

  const fTx = await c.finalizeNegotiation(id, { nonce: await p.getTransactionCount(w.address, "latest") });
  await fTx.wait();
  console.log("Finalized");

  const acTx = await c.activateTreaty(id, { nonce: await p.getTransactionCount(w.address, "latest") });
  await acTx.wait();
  console.log("Activated!");

  console.log(`\nTotal treaties now: ${await c.treatyCount()}`);
  for (let i = 0; i < await c.treatyCount(); i++) {
    const tid = await c.treatyIds(i);
    const st = await c.getTreatyState(tid);
    const states = ["PROPOSED","NEGOTIATING","VALIDATING","ACTIVE","DEGRADING","RENEGOTIATING","BREACHED","CURING","ARBITRATING","RESOLVING","SETTLING","SETTLED","TERMINATED"];
    console.log(`  #${i}: ${tid.slice(0,14)}... ${states[st.state]}`);
  }
}

main().catch(console.error);
