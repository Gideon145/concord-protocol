import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export interface ConcordConfig {
    // ── Chain ──
    rpcUrl: string;
    chainId: number;
    
    // ── Contracts ──
    treatyContract: string;
    constitutionRegistry: string;
    mediatorSwarm: string;
    
    // ── Agent ──
    agentPrivateKey: string;
    agentAddress: string;
    monitorIntervalMs: number;
    statusPort: number;
    
    // ── Cleanverse API ──
    cleanverseChain: string;
    cleanverseAtoken: string;
    
    // ── Oracles ──
    cviOracle: string;
    cvaOracle: string;
    ccpGateway: string;
    
    // ── Monitoring ──
    maxTreatiesPerCycle: number;
    degradationThresholdPercent: number;
    maxConsecutiveDegradationCycles: number;
    breachGraceBlocks: number;
    
    // ── Demo Mode ──
    demoMode: boolean;
}

export function loadConfig(): ConcordConfig {
    return {
        rpcUrl: process.env.RPC_URL || "https://testnet.monad.xyz",
        chainId: parseInt(process.env.CHAIN_ID || "10143"),
        
        treatyContract: process.env.TREATY_CONTRACT || "0x0000000000000000000000000000000000000000",
        constitutionRegistry: process.env.CONSTITUTION_REGISTRY || "0x0000000000000000000000000000000000000000",
        mediatorSwarm: process.env.MEDIATOR_SWARM || "0x0000000000000000000000000000000000000000",
        
        agentPrivateKey: process.env.AGENT_PRIVATE_KEY || "",
        agentAddress: process.env.AGENT_ADDRESS || "",
        monitorIntervalMs: parseInt(process.env.MONITOR_INTERVAL_MS || "15000"),
        statusPort: parseInt(process.env.STATUS_PORT || "3001"),
        
        cleanverseChain: process.env.CLEANVERSE_CHAIN || "monad",
        cleanverseAtoken: process.env.CLEANVERSE_ATOKEN || "0xaC0893567D43C3E7e6e35a72803df05416C1f20D",
        
        cviOracle: process.env.CVI_ORACLE || "",
        cvaOracle: process.env.CVA_ORACLE || "",
        ccpGateway: process.env.CCP_GATEWAY || "",
        
        maxTreatiesPerCycle: parseInt(process.env.MAX_TREATIES_PER_CYCLE || "50"),
        degradationThresholdPercent: parseInt(process.env.DEGRADATION_THRESHOLD_PERCENT || "10"),
        maxConsecutiveDegradationCycles: parseInt(process.env.MAX_CONSECUTIVE_DEGRADATION || "3"),
        breachGraceBlocks: parseInt(process.env.BREACH_GRACE_BLOCKS || "7200"), // ~24h on Monad
        
        demoMode: process.env.DEMO_MODE === "true" || !process.env.DEMO_MODE, // Default true for hackathon
    };
}
