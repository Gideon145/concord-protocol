/**
 * Seed 2 more Monad treaties — creates total of 3 for the demo dashboard
 */
import { ethers } from "ethers";
const TreatyArtifact = require("./src/abis/TreatyContract.json");

const RPC = "https://testnet-rpc.monad.xyz";
const KEY = "0x4cc26ae6ac86a78767983d276293e66da104ca7ed7f2ec461721d3f749c13934";
const ADDR = "0x42f2EBAa948681118DAac17EEc7e7EE93ae0FAd5";
const TREATY = "0x55ccE18b8A750cc738841174DFEA0516810CA683";

async function seedOne(name: string, amount: string, rate: number, dur: bigint, cr: number, lt: number) {
  const p = new ethers.JsonRpcProvider(RPC);
  const w = new ethers.Wallet(KEY, p);
  const c = new ethers.Contract(TREATY, TreatyArtifact.abi, w);
  const cp = ethers.Wallet.createRandom();

  const terms = {
    partyACVI: ethers.ZeroHash, partyBCVI: ethers.ZeroHash,
    minTierA: 0, minTierB: 0,
    amount: ethers.parseUnits(amount, 6),
    interestRate: rate, duration: dur,
    collateralRatio: cr, liquidationThreshold: lt,
    monitoredConditions: 0x3FFn,
    breachGraceBlocks: 1440n, renegotiationWindow: 720n,
    maxRenegotiationRounds: 3,
    settlementAsset: "0x0000000000000000000000000000000000000000",
    penaltyBps: 500,
  };

  const nonce = await p.getTransactionCount(ADDR, "latest");
  const tx = await c.proposeTreaty(cp.address, terms, { nonce, gasLimit: 500000 });
  await tx.wait();
  console.log(`${name}: proposed at nonce ${nonce} → counterparty ${cp.address.slice(0,10)}...`);
}

async function main() {
  const p = new ethers.JsonRpcProvider(RPC);
  console.log("Balance:", ethers.formatEther(await p.getBalance(ADDR)), "MON");
  
  const c = new ethers.Contract(TREATY, TreatyArtifact.abi, new ethers.Wallet(KEY, p));
  const existing = Number(await c.treatyCount());
  console.log("Existing:", existing, "treaties");

  const needed = Math.max(0, 3 - existing);
  if (needed === 0) { console.log("Already have 3+"); return; }

  const templates = [
    ["Moodly x FlowPay — $25K", "25000", 650, 20160n, 12000, 11000],
    ["SpendWise x Lifestyle — $10K", "10000", 950, 5040n, 20000, 15000],
  ];

  for (let i = 0; i < needed && i < templates.length; i++) {
    const [name, amt, rate, dur, cr, lt] = templates[i];
    await seedOne(name as string, amt as string, rate as number, dur as bigint, cr as number, lt as number);
  }

  const final = Number(await c.treatyCount());
  console.log(`\nDone — ${final} treaties on Monad`);
}

main().catch(console.error);
