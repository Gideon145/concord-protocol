/**
 * CONCORD — Full Demo Setup
 * Restarts anvil, deploys contracts, seeds 3 treaties, starts agent.
 * Run: npx tsx setup-demo.ts
 */

import { ethers } from "ethers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreatyArtifact = require("./src/abis/TreatyContract.json");

const RPC = "http://localhost:8545";
const TREATY_ADDR = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const AGENT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const AGENT_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const COUNTERPARTIES = [
  { addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
];

const DEMOS = [
  { name: "AlphaMind × BrandSketch", cp: 0, amount: "50000", rate: 800, dur: 10080n, cr: 15000, lt: 12000 },
  { name: "Moodly × FlowPay", cp: 1, amount: "25000", rate: 650, dur: 20160n, cr: 12000, lt: 11000 },
  { name: "SpendWise × Lifestyle", cp: 0, amount: "10000", rate: 950, dur: 5040n, cr: 20000, lt: 15000 },
];

async function main() {
  const p = new ethers.JsonRpcProvider(RPC);
  const w = new ethers.Wallet(AGENT_KEY, p);
  const c = new ethers.Contract(TREATY_ADDR, TreatyArtifact.abi, w);

  console.log("🌿 CONCORD Demo Setup\n");
  console.log(`Agent: ${AGENT_ADDR}`);
  console.log(`Chain: ${(await p.getNetwork()).chainId}\n`);

  // Check existing
  const existing = Number(await c.treatyCount());
  if (existing >= 3) {
    // Check if any are not ACTIVE
    let allActive = true;
    for (let i = 0; i < existing; i++) {
      const id = await c.treatyIds(i);
      const st = await c.getTreatyState(id);
      if (Number(st.state) !== 3) allActive = false;
    }
    if (allActive) {
      console.log(`✅ ${existing} treaties already ACTIVE. Nothing to do.`);
      return;
    }
    console.log(`${existing} treaties exist but not all active — advancing them...\n`);
  }

  const needTreaties = Math.max(0, 3 - existing);
  console.log(`Need to create ${needTreaties} treaties\n`);

  // Create and advance each treaty
  for (let i = 0; i < needTreaties; i++) {
    const demo = DEMOS[existing + i];
    if (!demo) continue;
    const cp = COUNTERPARTIES[demo.cp];

    console.log(`── Treaty ${existing + i + 1}/3: ${demo.name} ──`);
    const terms = {
      partyACVI: ethers.ZeroHash, partyBCVI: ethers.ZeroHash,
      minTierA: 0, minTierB: 0,
      amount: ethers.parseUnits(demo.amount, 6),
      interestRate: demo.rate,
      duration: demo.dur,
      collateralRatio: demo.cr,
      liquidationThreshold: demo.lt,
      monitoredConditions: 0x3FFn,
      breachGraceBlocks: 1440n, renegotiationWindow: 720n,
      maxRenegotiationRounds: 3,
      settlementAsset: "0x0000000000000000000000000000000000000000",
      penaltyBps: 500,
    };

    // Step 1: Propose and get treatyId from event
    let nonce = await p.getTransactionCount(AGENT_ADDR, "latest");
    const txP = await c.proposeTreaty(cp.addr, terms, { nonce });
    const receipt = await txP.wait();
    // Parse treatyId from TreatyProposed event
    const iface = new ethers.Interface(TreatyArtifact.abi);
    const treatyId = receipt.logs
      .map((log: any) => { try { return iface.parseLog({ topics: log.topics as string[], data: log.data }); } catch { return null; } })
      .find((parsed: any) => parsed?.name === "TreatyProposed")?.args?.treatyId;
    if (!treatyId) throw new Error("Could not parse treatyId from receipt");
    console.log(`  ID: ${treatyId.slice(0, 14)}...`);
    console.log(`  ✅ Proposed`);

    // Step 3: Accept (counterparty)
    const cpW = new ethers.Wallet(cp.key, p);
    const cpC = new ethers.Contract(TREATY_ADDR, TreatyArtifact.abi, cpW);
    const cpNonce = await p.getTransactionCount(cp.addr, "latest");
    const txA = await cpC.acceptNegotiation(treatyId, { nonce: cpNonce });
    await txA.wait();
    console.log(`  ✅ Accepted`);

    // Step 4: Finalize (agent)
    nonce = await p.getTransactionCount(AGENT_ADDR, "latest");
    const txF = await c.finalizeNegotiation(treatyId, { nonce });
    await txF.wait();
    console.log(`  ✅ Finalized`);

    // Step 5: Activate (agent)
    nonce = await p.getTransactionCount(AGENT_ADDR, "latest");
    const txAct = await c.activateTreaty(treatyId, { nonce });
    await txAct.wait();
    console.log(`  ✅ Activated`);
    console.log();
  }

  // Also advance any existing PROPOSED treaties
  const total = Number(await c.treatyCount());
  for (let i = 0; i < total; i++) {
    const id = await c.treatyIds(i);
    const st = await c.getTreatyState(id);
    const stateNum = Number(st.state);

    if (stateNum >= 3) continue; // Already active or beyond

    console.log(`── Advancing treaty #${i} (state=${stateNum}) ──`);
    const partyB = st.partyB;
    const cpKey = COUNTERPARTIES.find(cp => cp.addr.toLowerCase() === partyB.toLowerCase())?.key;
    if (!cpKey) { console.log(`  ⚠ Unknown counterparty ${partyB}`); continue; }

    let nonce = await p.getTransactionCount(AGENT_ADDR, "latest");

    if (stateNum === 0) {
      // Accept
      const cpW = new ethers.Wallet(cpKey, p);
      const cpC = new ethers.Contract(TREATY_ADDR, TreatyArtifact.abi, cpW);
      const txA = await cpC.acceptNegotiation(id, { nonce: await p.getTransactionCount(partyB, "latest") });
      await txA.wait();
      console.log("  ✅ Accepted");
    }
    if (stateNum <= 1) {
      nonce = await p.getTransactionCount(AGENT_ADDR, "latest");
      const txF = await c.finalizeNegotiation(id, { nonce });
      await txF.wait();
      console.log("  ✅ Finalized");
    }
    if (stateNum <= 2) {
      nonce = await p.getTransactionCount(AGENT_ADDR, "latest");
      const txAct = await c.activateTreaty(id, { nonce });
      await txAct.wait();
      console.log("  ✅ Activated");
    }
    console.log();
  }

  // Final summary
  console.log("── Final State ──");
  const final = Number(await c.treatyCount());
  const states = ["PROPOSED","NEGOTIATING","VALIDATING","ACTIVE","DEGRADING"];
  for (let i = 0; i < final; i++) {
    const id = await c.treatyIds(i);
    const st = await c.getTreatyState(id);
    const h = await c.getTreatyHealth(id);
    console.log(`  #${i}: ${id.slice(0,14)}... ${states[Number(st.state)]} health=${h.health} "${h.status}"`);
  }
  console.log(`\n🎉 ${final} treaties ready!`);
}

main().catch(e => { console.error(e); process.exit(1); });
