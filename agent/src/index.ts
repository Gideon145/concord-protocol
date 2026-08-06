/**
 * CONCORD — Living Treaty Protocol
 * Monitor Agent Entry Point
 * 
 * 15-second autonomous monitoring loop (Parry pattern).
 * HTTP status server for frontend dashboard.
 * Railway-deployable.
 */

import express from "express";
import cors from "cors";
import { loadConfig } from "./config";
import { CleanverseClient } from "./cleanverse";
import { TreatyClient } from "./treaty";
import { TreatyMonitor, MonitoringResult } from "./monitor";
import { NegotiationEngine } from "./negotiation";

// ──── STATE ────────────────────────────────────────────

interface AgentState {
    status: "starting" | "running" | "stopped" | "error";
    startTime: number;
    cycleCount: number;
    lastCycleTime: number;
    activeTreaties: number;
    treatiesMonitored: number;
    alertsTriggered: number;
    renegotiationsInitiated: number;
    breachesDetected: number;
    lastCycleResults: MonitoringResult[];
    lastError: string | null;
}

// ──── INIT ──────────────────────────────────────────────

const config = loadConfig();
const cleanverse = new CleanverseClient(config);
let treaty: TreatyClient;
let monitor: TreatyMonitor;
let negotiation: NegotiationEngine;

try {
    treaty = new TreatyClient(config);
    monitor = new TreatyMonitor(config, cleanverse, treaty);
} catch (err: any) {
    console.error("[Agent] WARNING: Could not initialize TreatyClient:", err.message);
    console.error("[Agent] Server will start but on-chain operations are disabled.");
    // Dummy objects — server runs, monitoring is skipped
    treaty = null as any;
    monitor = null as any;
}
negotiation = new NegotiationEngine();

const state: AgentState = {
    status: "starting",
    startTime: Date.now(),
    cycleCount: 0,
    lastCycleTime: 0,
    activeTreaties: 0,
    treatiesMonitored: 0,
    alertsTriggered: 0,
    renegotiationsInitiated: 0,
    breachesDetected: 0,
    lastCycleResults: [],
    lastError: null,
};

// ──── EXPRESS SETUP ────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// BigInt serialization fix for Express
app.set("json replacer", (_key: string, value: any) => {
    if (typeof value === "bigint") return value.toString();
    return value;
});

app.get("/status", (_req, res) => {
    res.json({
        ...state,
        uptime: Date.now() - state.startTime,
        config: {
            chainId: config.chainId,
            treatyContract: config.treatyContract,
            monitorIntervalMs: config.monitorIntervalMs,
        },
    });
});

app.get("/health", (_req, res) => {
    res.json({
        status: state.status,
        cycleCount: state.cycleCount,
        lastCycleTime: state.lastCycleTime,
        activeTreaties: state.activeTreaties,
    });
});

app.get("/treaties", async (_req, res) => {
    try {
        if (!treaty) return res.json({ treaties: [], total: 0, message: "Agent not connected to chain" });
        const ids = await treaty.getActiveTreaties();
        const treatyData = [];
        for (const id of ids.slice(0, 10)) {
            const treatyState = await treaty.getTreatyState(id);
            const health = await treaty.getTreatyHealth(id);
            treatyData.push({
                treatyId: id,
                state: Number(treatyState.state),
                health: health.health,
                status: health.status,
                activatedAt: Number(treatyState.activatedAt),
                degradationCount: Number(treatyState.degradationCount),
                renegotiationCount: Number(treatyState.renegotiationCount),
                breachCount: Number(treatyState.breachCount),
            });
        }
        res.json({ treaties: treatyData, total: ids.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/treaties/:id", async (req, res) => {
    try {
        const treatyState = await treaty.getTreatyState(req.params.id);
        const health = await treaty.getTreatyHealth(req.params.id);
        res.json({
            treatyId: req.params.id,
            state: Number(treatyState.state),
            stateName: ["PROPOSED","NEGOTIATING","VALIDATING","ACTIVE","DEGRADING",
                        "RENEGOTIATING","BREACHED","CURING","ARBITRATING","RESOLVING",
                        "SETTLING","SETTLED","TERMINATED"][Number(treatyState.state)],
            health: health.health,
            status: health.status,
            terms: {
                amount: treatyState.terms.amount.toString(),
                interestRate: Number(treatyState.terms.interestRate),
                duration: Number(treatyState.terms.duration),
                collateralRatio: Number(treatyState.terms.collateralRatio) / 100,
                liquidationThreshold: Number(treatyState.terms.liquidationThreshold) / 100,
            },
            partyA: treatyState.partyA,
            partyB: treatyState.partyB,
            activatedAt: Number(treatyState.activatedAt),
            escrowBalance: treatyState.escrowBalance.toString(),
            degradationCount: Number(treatyState.degradationCount),
            renegotiationCount: Number(treatyState.renegotiationCount),
            breachCount: Number(treatyState.breachCount),
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/monitor/cycle", (_req, res) => {
    res.json({
        cycleCount: state.cycleCount,
        lastCycleTime: state.lastCycleTime,
        results: state.lastCycleResults.slice(0, 20),
    });
});

// ──── MAIN LOOP ─────────────────────────────────────────

async function mainLoop(): Promise<void> {
    const startTime = Date.now();

    if (!monitor || !treaty) {
        // Skip monitoring if not connected
        state.cycleCount++;
        state.lastCycleTime = Date.now();
        return;
    }

    try {
        const results = await monitor.runCycle();

        state.cycleCount++;
        state.lastCycleTime = Date.now();
        state.lastCycleResults = results;

        // Count new states
        for (const r of results) {
            if (r.breachTier > 0) state.breachesDetected++;
            if (r.newState === 4) state.alertsTriggered++; // DEGRADING
        }

        // Update active treaty count
        const allTreaties = await treaty.getActiveTreaties();
        state.activeTreaties = allTreaties.length;
        state.treatiesMonitored = Math.min(allTreaties.length, config.maxTreatiesPerCycle);

    } catch (err: any) {
        console.error("[Agent] Main loop error:", err.message);
        state.lastError = err.message;
    }

    const elapsed = Date.now() - startTime;
    if (state.cycleCount % 20 === 0) { // Log every ~5 minutes
        console.log(`[Agent] Cycle ${state.cycleCount} | ${elapsed}ms | ${state.activeTreaties} treaties | breaches: ${state.breachesDetected}`);
    }
}

// ──── START ─────────────────────────────────────────────

async function start(): Promise<void> {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║        CONCORD — Living Treaty Agent     ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`Chain ID: ${config.chainId}`);
    console.log(`RPC: ${config.rpcUrl}`);
    console.log(`TreatyContract: ${config.treatyContract}`);
    console.log(`ConstitutionRegistry: ${config.constitutionRegistry}`);
    console.log(`MediatorSwarm: ${config.mediatorSwarm}`);
    console.log(`Cleanverse API: ${config.cleanverseApiBase}`);
    console.log(`Monitor interval: ${config.monitorIntervalMs}ms`);
    console.log(`Status server: :${config.statusPort}`);
    console.log("");

    // Start HTTP server
    app.listen(config.statusPort, () => {
        console.log(`[Agent] Status server listening on :${config.statusPort}`);
    });

    // Verify contract connections
    try {
        if (treaty) {
            const count = await treaty.getActiveTreaties();
            console.log(`[Agent] Connected. Active treaties on-chain: ${count.length}`);
        } else {
            console.log("[Agent] Running in server-only mode (no chain connection).");
        }
    } catch (err: any) {
        console.error("[Agent] WARNING: Could not connect to TreatyContract:", err.message);
        console.error("[Agent] Check RPC_URL and TREATY_CONTRACT in .env");
    }

    // Start monitoring loop
    state.status = "running";
    console.log("[Agent] Monitor loop started.");

    setInterval(mainLoop, config.monitorIntervalMs);

    // Run first cycle immediately
    await mainLoop();
}

// ──── GRACEFUL SHUTDOWN ────────────────────────────────

process.on("SIGINT", () => {
    console.log("[Agent] Shutting down...");
    state.status = "stopped";
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("[Agent] Shutting down...");
    state.status = "stopped";
    process.exit(0);
});

// ──── GO ────────────────────────────────────────────────

start().catch((err) => {
    console.error("[Agent] Fatal error:", err);
    state.status = "error";
    state.lastError = err.message;
    process.exit(1);
});

export { app, state, monitor, negotiation, treaty, cleanverse };
