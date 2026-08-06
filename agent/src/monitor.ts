/**
 * Continuous Treaty Monitor
 * 
 * The 15-second autonomous loop that evaluates all treaty conditions.
 * Implements the Parry agent pattern: parallel data collection → evaluation → attestation.
 * 
 * 10 conditions evaluated per cycle:
 *   4 HARD (breach = immediate action)
 *   6 SOFT (degradation = trigger renegotiation)
 */

import { CleanverseClient, CVIStatus, CVAProvenance } from "./cleanverse";
import { TreatyClient, TreatyState, BreachTier, TreatyTermsOnChain } from "./treaty";
import { ConcordConfig } from "./config";
import { createHash } from "crypto";

// ──── TYPES ────────────────────────────────────────────

export interface MonitoringResult {
    treatyId: string;
    timestamp: number;
    conditionsBitmap: bigint;
    newState: TreatyState;
    breachTier: BreachTier;
    reason: string;
    blake3Hash: string;
    details: ConditionDetails;
}

export interface ConditionDetails {
    cviStatusA: boolean;
    cviStatusB: boolean;
    cvaClean: boolean;
    collateralRatio: number;         // e.g., 152 = 152%
    paymentCurrent: boolean;
    collateralApproaching: boolean;
    yieldOnTarget: boolean;
    counterpartyHealthy: boolean;
    oracleStable: boolean;
    liquidityAdequate: boolean;
    milestonesOnTrack: boolean;
}

// ──── MONITOR ────────────────────────────────────────────

export class TreatyMonitor {
    private cleanverse: CleanverseClient;
    private treaty: TreatyClient;
    private config: ConcordConfig;
    private consecutiveDegradation: Map<string, number> = new Map();

    // Condition bit positions
    private static readonly BIT_CVI_STATUS = 0;
    private static readonly BIT_CVA_PROVENANCE = 1;
    private static readonly BIT_COLLATERAL = 2;
    private static readonly BIT_PAYMENT = 3;
    private static readonly BIT_COLLATERAL_SOFT = 4;
    private static readonly BIT_YIELD = 5;
    private static readonly BIT_HEALTH = 6;
    private static readonly BIT_ORACLE = 7;
    private static readonly BIT_LIQUIDITY = 8;
    private static readonly BIT_MILESTONES = 9;

    constructor(config: ConcordConfig, cleanverse: CleanverseClient, treaty: TreatyClient) {
        this.config = config;
        this.cleanverse = cleanverse;
        this.treaty = treaty;
    }

    /**
     * Main monitoring cycle — called every 15 seconds.
     * Evaluates ALL active treaties.
     */
    async runCycle(): Promise<MonitoringResult[]> {
        const results: MonitoringResult[] = [];
        
        try {
            const activeTreaties = await this.treaty.getActiveTreaties();
            
            // Limit per cycle to prevent overload
            const toMonitor = activeTreaties.slice(0, this.config.maxTreatiesPerCycle);

            for (const treatyId of toMonitor) {
                const state = await this.treaty.getTreatyState(treatyId);
                
                // Only monitor ACTIVE, DEGRADING, and CURING treaties
                const stateNum = Number(state.state);
                if (stateNum !== TreatyState.ACTIVE && 
                    stateNum !== TreatyState.DEGRADING && 
                    stateNum !== TreatyState.CURING) {
                    continue;
                }

                const result = await this._evaluateTreaty(treatyId, state);
                results.push(result);

                // Record attestation on-chain
                if (result.newState !== stateNum || result.breachTier !== BreachTier.NONE) {
                    await this.treaty.recordAttestation(
                        treatyId,
                        result.conditionsBitmap,
                        result.blake3Hash,
                        result.newState,
                        result.reason,
                        result.breachTier
                    );
                }
            }
        } catch (err) {
            console.error("[Monitor] Cycle failed:", err);
        }

        return results;
    }

    /**
     * Evaluate all conditions for a single treaty.
     */
    private async _evaluateTreaty(
        treatyId: string,
        state: any
    ): Promise<MonitoringResult> {
        const terms: TreatyTermsOnChain = state.terms;
        const details: ConditionDetails = {
            cviStatusA: true,
            cviStatusB: true,
            cvaClean: true,
            collateralRatio: 150,
            paymentCurrent: true,
            collateralApproaching: false,
            yieldOnTarget: true,
            counterpartyHealthy: true,
            oracleStable: true,
            liquidityAdequate: true,
            milestonesOnTrack: true,
        };

        // ── STAGE 1: COLLECT (parallel data gathering) ──

        if (this.config.demoMode) {
            // Demo mode: skip real Cleanverse API calls, keep all conditions healthy
            // This prevents spurious breaches on local anvil where counterparties lack A-Passes
            details.cviStatusA = true;
            details.cviStatusB = true;
            details.cvaClean = true;
            details.collateralRatio = 150;
            details.paymentCurrent = true;
            details.collateralApproaching = false;
            details.yieldOnTarget = true;
            details.counterpartyHealthy = true;
            details.oracleStable = true;
            details.liquidityAdequate = true;
            details.milestonesOnTrack = true;
        } else {
            // ① CVI Status check for both parties (real Cleanverse sandbox API)
            const [cviA, cviB] = await Promise.all([
                this.cleanverse.verifyCVI(state.partyA, this.config.cleanverseChain, this.config.cleanverseAtoken),
                this.cleanverse.verifyCVI(state.partyB, this.config.cleanverseChain, this.config.cleanverseAtoken),
            ]);
            details.cviStatusA = cviA.hasAPass && cviA.canTransfer;
            details.cviStatusB = cviB.hasAPass && cviB.canTransfer;

            // ② CVA Provenance check (real Cleanverse sandbox API)
            const cva = await this.cleanverse.verifyCVA(
                terms.settlementAsset,
                this.config.cleanverseChain,
                state.partyA // holder address
            );
            details.cvaClean = cva.isClean && !cva.sanctionsFlagged;

            // ③-④ Collateral & Payment (on-chain)
            // In production: query actual on-chain collateral ratio and payment status
            // For hackathon: simulate with realistic values
            details.collateralRatio = this._simulateCollateralRatio(treatyId, terms);
            details.paymentCurrent = this._simulatePaymentStatus(treatyId, state);

            // ⑤-⑩ Soft conditions
            details.collateralApproaching = this._isApproachingThreshold(
                details.collateralRatio,
                Number(terms.liquidationThreshold) / 100,
                this.config.degradationThresholdPercent
            );
            details.yieldOnTarget = this._simulateYieldStatus(treatyId);
            details.counterpartyHealthy = true; // Would query risk oracle
            details.oracleStable = true;        // Would query Pyth + Switchboard
            details.liquidityAdequate = true;   // Would query pool liquidity
            details.milestonesOnTrack = true;   // Would check time-based milestones
        }

        // ── STAGE 2: BUILD CONDITIONS BITMAP ──

        let bitmap = 0n;
        if (details.cviStatusA && details.cviStatusB) bitmap |= (1n << BigInt(TreatyMonitor.BIT_CVI_STATUS));
        if (details.cvaClean) bitmap |= (1n << BigInt(TreatyMonitor.BIT_CVA_PROVENANCE));
        if (details.collateralRatio >= Number(terms.liquidationThreshold) / 100) bitmap |= (1n << BigInt(TreatyMonitor.BIT_COLLATERAL));
        if (details.paymentCurrent) bitmap |= (1n << BigInt(TreatyMonitor.BIT_PAYMENT));
        if (!details.collateralApproaching) bitmap |= (1n << BigInt(TreatyMonitor.BIT_COLLATERAL_SOFT));
        if (details.yieldOnTarget) bitmap |= (1n << BigInt(TreatyMonitor.BIT_YIELD));
        if (details.counterpartyHealthy) bitmap |= (1n << BigInt(TreatyMonitor.BIT_HEALTH));
        if (details.oracleStable) bitmap |= (1n << BigInt(TreatyMonitor.BIT_ORACLE));
        if (details.liquidityAdequate) bitmap |= (1n << BigInt(TreatyMonitor.BIT_LIQUIDITY));
        if (details.milestonesOnTrack) bitmap |= (1n << BigInt(TreatyMonitor.BIT_MILESTONES));

        // ── STAGE 3: STATE ASSESSMENT ──

        let newState: TreatyState = TreatyState.ACTIVE;
        let breachTier: BreachTier = BreachTier.NONE;
        let reason = "All conditions nominal";

        // HARD BREACH CHECKS (in priority order)
        if (!details.cviStatusA || !details.cviStatusB) {
            newState = TreatyState.BREACHED;
            breachTier = BreachTier.FUNDAMENTAL;
            reason = `CVI credential revoked: A=${details.cviStatusA} B=${details.cviStatusB}`;
        } else if (!details.cvaClean) {
            newState = TreatyState.BREACHED;
            breachTier = BreachTier.FUNDAMENTAL;
            reason = "CVA asset provenance flagged";
        } else if (details.collateralRatio < Number(terms.liquidationThreshold) / 100) {
            newState = TreatyState.BREACHED;
            breachTier = BreachTier.MATERIAL;
            reason = `Collateral ratio ${details.collateralRatio}% below liquidation ${Number(terms.liquidationThreshold) / 100}%`;
        } else if (!details.paymentCurrent) {
            newState = TreatyState.BREACHED;
            breachTier = BreachTier.MINOR;
            reason = "Payment default detected";
        }
        // SOFT DEGRADATION CHECKS
        else if (details.collateralApproaching || !details.yieldOnTarget) {
            newState = TreatyState.DEGRADING;
            breachTier = BreachTier.NONE;

            // Track consecutive degradation
            const count = (this.consecutiveDegradation.get(treatyId) || 0) + 1;
            this.consecutiveDegradation.set(treatyId, count);

            if (count >= this.config.maxConsecutiveDegradationCycles) {
                // Escalate to BREACHED after max consecutive cycles
                newState = TreatyState.BREACHED;
                breachTier = BreachTier.MATERIAL;
                reason = `Degradation sustained for ${count} cycles without recovery`;
                this.consecutiveDegradation.set(treatyId, 0);
            } else {
                reason = details.collateralApproaching
                    ? `Collateral approaching threshold: ${details.collateralRatio}%`
                    : "Yield below target for multiple cycles";
            }
        } else {
            // All clear — reset degradation counter
            this.consecutiveDegradation.set(treatyId, 0);
        }

        // ── STAGE 4: BLAKE3 ATTESTATION ──

        const hashInput = `${treatyId}:${Date.now()}:${bitmap}:${newState}:${breachTier}:${reason}`;
        const blake3Hash = "0x" + createHash("sha256").update(hashInput).digest("hex"); // Using SHA256 as Blake3 polyfill

        return {
            treatyId,
            timestamp: Date.now(),
            conditionsBitmap: bitmap,
            newState,
            breachTier,
            reason,
            blake3Hash,
            details,
        };
    }

    // ──── SIMULATION HELPERS (replace with real queries post-hackathon) ──

    private _simulateCollateralRatio(treatyId: string, terms: TreatyTermsOnChain): number {
        // Simulate realistic collateral fluctuations
        const base = Number(terms.collateralRatio) / 100;
        const hash = createHash("sha256").update(treatyId + Date.now()).digest("hex");
        const variation = (parseInt(hash.slice(0, 4), 16) % 40) - 20; // -20 to +20
        return base + variation; // e.g., 150 ± 20
    }

    private _simulatePaymentStatus(treatyId: string, state: any): boolean {
        // In production: check if payment was made in the expected block window
        return true;
    }

    private _simulateYieldStatus(treatyId: string): boolean {
        // In production: compare actual yield vs target
        return Math.random() > 0.1; // 90% chance yield is on target for demo
    }

    private _isApproachingThreshold(
        current: number,
        threshold: number,
        degradationPercent: number
    ): boolean {
        const margin = threshold * (degradationPercent / 100);
        return current <= (threshold + margin) && current > threshold;
    }
}
