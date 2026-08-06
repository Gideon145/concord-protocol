/**
 * Auto-forward MON from relay wallet to deploy wallet
 * Polls every 5s. Run: npx tsx relay.ts
 */

import { ethers } from "ethers";

const RELAY_KEY = "0x4cc26ae6ac86a78767983d276293e66da104ca7ed7f2ec461721d3f749c13934";
const RELAY_ADDR = "0x42f2EBAa948681118DAac17EEc7e7EE93ae0FAd5";
const DEPLOY_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const RPC = "https://testnet-rpc.monad.xyz";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(RELAY_KEY, provider);

  console.log(`🔄 Relay: ${RELAY_ADDR} → ${DEPLOY_ADDR}`);
  console.log(`Monitoring every 5s...\n`);

  let lastBalance = -1n;

  while (true) {
    try {
      const balance = await provider.getBalance(RELAY_ADDR);
      const mon = Number(balance) / 1e18;

      if (balance !== lastBalance) {
        console.log(`Balance: ${mon.toFixed(6)} MON`);
        lastBalance = balance;
      }

      // Forward if we have > 1 MON (leave 0.1 for gas on relay)
      const gasPrice = (await provider.getFeeData()).gasPrice || 100_000_000_000n; // 100 gwei fallback
      const gasCost = 21000n * gasPrice; // ~0.002 MON at 100 gwei
      const minKeep = gasCost * 3n; // keep 3x gas cost as buffer
      const minForward = minKeep + ethers.parseEther("0.5"); // forward if > 0.5 MON after buffer

      if (balance > minForward) {
        const amount = balance - minKeep;
        console.log(`\n📤 Forwarding ${Number(amount) / 1e18} MON to ${DEPLOY_ADDR}...`);

        const tx = await wallet.sendTransaction({
          to: DEPLOY_ADDR,
          value: amount,
          gasLimit: 21000,
        });
        console.log(`  TX: ${tx.hash}`);
        await tx.wait();
        console.log(`  ✅ Confirmed!\n`);
        lastBalance = 0n;
      }
    } catch (err: any) {
      // Silently retry — RPC errors are common
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

main().catch(console.error);
