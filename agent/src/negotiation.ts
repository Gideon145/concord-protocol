/**
 * Structured Negotiation Engine
 * 
 * Enables two AI agents to negotiate treaty terms through structured
 * parameter exchange — not free-form LLM chat. Terms are proposed,
 * counter-offered, and finalized through a deterministic protocol.
 */

import { TreatyTermsOnChain } from "./treaty";

// ──── TYPES ────────────────────────────────────────────

export interface NegotiationOffer {
    round: number;
    proposer: "A" | "B";
    terms: TreatyTermsOnChain;
    timestamp: number;
    expiresAt: number;          // Offer expires after this timestamp
}

export interface NegotiationSession {
    treatyId: string;
    partyA: string;
    partyB: string;
    startedAt: number;
    currentRound: number;
    maxRounds: number;
    offers: NegotiationOffer[];
    status: "active" | "accepted" | "rejected" | "deadlocked" | "finalized";
}

export interface RenegotiationProposal {
    treatyId: string;
    trigger: string;                // Which condition triggered renegotiation
    currentValue: number;           // Current value of the degraded condition
    threshold: number;              // Threshold that was approached
    proposedChanges: {
        parameter: string;          // e.g., "collateralRatio"
        oldValue: number;
        newValue: number;
    }[];
    compensation: {
        parameter: string;          // e.g., "interestRate"
        oldValue: number;
        newValue: number;
    }[];
    justification: string;
}

// ──── ENGINE ────────────────────────────────────────────

export class NegotiationEngine {
    private sessions: Map<string, NegotiationSession> = new Map();

    /**
     * Start a new negotiation session between two agents.
     */
    startSession(
        treatyId: string,
        partyA: string,
        partyB: string,
        initialTerms: TreatyTermsOnChain,
        maxRounds: number = 3
    ): NegotiationSession {
        const session: NegotiationSession = {
            treatyId,
            partyA,
            partyB,
            startedAt: Date.now(),
            currentRound: 0,
            maxRounds,
            offers: [{
                round: 0,
                proposer: "A",
                terms: initialTerms,
                timestamp: Date.now(),
                expiresAt: Date.now() + 300_000, // 5 minutes
            }],
            status: "active",
        };
        this.sessions.set(treatyId, session);
        return session;
    }

    /**
     * Make a counter-offer during negotiation.
     */
    makeCounterOffer(
        treatyId: string,
        proposer: "A" | "B",
        terms: TreatyTermsOnChain
    ): NegotiationOffer | null {
        const session = this.sessions.get(treatyId);
        if (!session || session.status !== "active") return null;
        if (session.currentRound >= session.maxRounds) {
            session.status = "deadlocked";
            return null;
        }

        session.currentRound++;
        const offer: NegotiationOffer = {
            round: session.currentRound,
            proposer,
            terms,
            timestamp: Date.now(),
            expiresAt: Date.now() + 300_000,
        };
        session.offers.push(offer);
        return offer;
    }

    /**
     * Accept the latest offer and finalize negotiation.
     */
    acceptOffer(treatyId: string): TreatyTermsOnChain | null {
        const session = this.sessions.get(treatyId);
        if (!session || session.status !== "active") return null;
        if (session.offers.length === 0) return null;

        session.status = "accepted";
        return session.offers[session.offers.length - 1].terms;
    }

    /**
     * Reject negotiation entirely.
     */
    rejectNegotiation(treatyId: string): void {
        const session = this.sessions.get(treatyId);
        if (session) session.status = "rejected";
    }

    /**
     * Generate a renegotiation proposal when a condition degrades.
     * 
     * This is the key innovation: instead of failing when conditions degrade,
     * the agent proposes amended terms with compensation.
     */
    generateRenegotiationProposal(
        treatyId: string,
        currentTerms: TreatyTermsOnChain,
        trigger: string,
        currentValue: number,
        threshold: number
    ): RenegotiationProposal {
        const proposal: RenegotiationProposal = {
            treatyId,
            trigger,
            currentValue,
            threshold,
            proposedChanges: [],
            compensation: [],
            justification: "",
        };

        // ── Logic for specific triggers ──

        if (trigger === "collateral_ratio_approaching") {
            // Lower collateral requirement → compensate with higher interest
            const ratioReduction = threshold - currentValue;
            const newCollateral = Math.max(110, currentValue); // Floor at 110%
            const interestIncrease = Math.ceil(ratioReduction * 10); // ~10bps per % of collateral reduction

            proposal.proposedChanges.push({
                parameter: "collateralRatio",
                oldValue: Number(currentTerms.collateralRatio) / 100,
                newValue: newCollateral,
            });
            proposal.compensation.push({
                parameter: "interestRate",
                oldValue: currentTerms.interestRate,
                newValue: currentTerms.interestRate + interestIncrease,
            });
            proposal.justification = `Collateral buffer reduced by ${ratioReduction}% offset by ${interestIncrease}bps rate increase. Net risk profile unchanged.`;
        }
        else if (trigger === "yield_below_target") {
            // Yield underperforming → extend duration or increase rate
            proposal.proposedChanges.push({
                parameter: "interestRate",
                oldValue: currentTerms.interestRate,
                newValue: currentTerms.interestRate + 50, // +50bps
            });
            proposal.compensation.push({
                parameter: "duration",
                oldValue: Number(currentTerms.duration),
                newValue: Number(currentTerms.duration) + 7200, // +~1 day of blocks
            });
            proposal.justification = "Yield below target compensated with higher rate and extended duration to capture recovery.";
        }
        else if (trigger === "oracle_deviation") {
            // Price moved significantly → add re-evaluation window
            proposal.proposedChanges.push({
                parameter: "renegotiationWindow",
                oldValue: Number(currentTerms.renegotiationWindow),
                newValue: Number(currentTerms.renegotiationWindow) / 2, // Tighter window
            });
            proposal.compensation.push({
                parameter: "interestRate",
                oldValue: currentTerms.interestRate,
                newValue: currentTerms.interestRate + 25,
            });
            proposal.justification = "Increased oracle volatility compensated with tighter renegotiation window and modest rate increase.";
        }
        else {
            proposal.justification = `Automatic renegotiation triggered by ${trigger}. Terms unchanged pending counterparty review.`;
        }

        return proposal;
    }

    /**
     * Evaluate whether a renegotiation proposal is fair.
     * Uses a simple scoring heuristic (in production: Mediator Swarm AI evaluation).
     */
    evaluateFairness(proposal: RenegotiationProposal): number {
        let score = 70; // Start neutral

        // Penalize large collateral reductions without adequate compensation
        for (const change of proposal.proposedChanges) {
            if (change.parameter === "collateralRatio") {
                const reduction = change.oldValue - change.newValue;
                if (reduction > 30) score -= 20;
                else if (reduction > 15) score -= 10;
            }
        }

        // Reward proportional compensation
        for (const comp of proposal.compensation) {
            if (comp.parameter === "interestRate") {
                const increase = comp.newValue - comp.oldValue;
                if (increase >= 100) score += 15;
                else if (increase >= 50) score += 10;
                else if (increase >= 25) score += 5;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get current negotiation session.
     */
    getSession(treatyId: string): NegotiationSession | undefined {
        return this.sessions.get(treatyId);
    }

    /**
     * Get all active negotiation sessions.
     */
    getActiveSessions(): NegotiationSession[] {
        return Array.from(this.sessions.values()).filter(s => s.status === "active");
    }
}
