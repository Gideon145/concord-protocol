/**
 * Quick Monad testnet treaty seeder
 * Creates 1 treaty directly from the relay wallet
 */
import { ethers } from "ethers";
const TreatyArtifact = require("./src/abis/TreatyContract.json");

const RPC = "https://testnet-rpc.monad.xyz";
const KEY = "0x4cc26ae6ac86a78767983d276293e66da104ca7ed7f2ec461721d3f749c13934";
const ADDR = "0x42f2EBAa948681118DAac17EEc7e7EE93ae0FAd5";
const TREATY = "0x55ccE18b8A750cc738841174DFEA0516810CA683";

async function main() {
  const p = new ethers.JsonRpcProvider(RPC);
  const w = new ethers.Wallet(KEY, p);
  const c = new ethers.Contract(TREATY, TreatyArtifact.abi, w);

  console.log("Balance:", ethers.formatEther(await p.getBalance(ADDR)), "MON");
  console.log("Existing treaties:", Number(await c.treatyCount()));

  // Create a random counterparty (we don't need their key — just need an address)
  const cp = ethers.Wallet.createRandom();
  console.log("Counterparty:", cp.address);

  const terms = {
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

  const nonce = await p.getTransactionCount(ADDR, "latest");
  console.log("Nonce:", nonce);
  console.log("Proposing...");
  const tx = await c.proposeTreaty(cp.address, terms, { nonce, gasLimit: 500000 });
  const receipt = await tx.wait();
  console.log("TX:", receipt.hash);

  const count = Number(await c.treatyCount());
  console.log("Treaties now:", count);
  if (count > 0) {
    const id = await c.treatyIds(0);
    console.log("TreatyId:", id);
  }
}

main().catch(e => console.error(e));
