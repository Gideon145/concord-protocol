/**
 * Treaty Contract Interaction Layer
 * 
 * Wraps all on-chain interactions with TreatyContract, ConstitutionRegistry,
 * and MediatorSwarm using ethers.js v6.
 */

import { ethers } from "ethers";
import { ConcordConfig } from "./config";

// ──── ABIS (full JSON from Forge compilation) ────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreatyArtifact = require("./abis/TreatyContract.json");
const TREATY_ABI = TreatyArtifact.abi;

// Keep human-readable for Constitution + Mediator since we only call simple view functions
const CONSTITUTION_ABI = [
    "function registerAgent(bytes32,uint8) external",
    "function addRule(string,string) external",
    "function sealConstitution() external",
    "function validateTreatyTerms(address,bytes32) external view returns (bool,uint256)",
    "function meetsTierRequirement(address,uint8) external view returns (bool)",
    "function isConstitutionSealed(address) external view returns (bool)",
];

const MEDIATOR_ABI = [
    "function startConsensus(bytes32,uint8,bytes32) external returns (uint256)",
    "function castVote(bytes32,uint256,uint8,string) external",
    "function isConsensusReached(bytes32,uint256) external view returns (bool,uint8,uint256)",
    "function setFairnessScore(bytes32,uint256,uint256,string) external",
];

// ──── TYPES ────────────────────────────────────────────

export enum TreatyState {
    PROPOSED = 0,
    NEGOTIATING = 1,
    VALIDATING = 2,
    ACTIVE = 3,
    DEGRADING = 4,
    RENEGOTIATING = 5,
    BREACHED = 6,
    CURING = 7,
    ARBITRATING = 8,
    RESOLVING = 9,
    SETTLING = 10,
    SETTLED = 11,
    TERMINATED = 12,
}

export enum BreachTier {
    NONE = 0,
    MINOR = 1,
    MATERIAL = 2,
    FUNDAMENTAL = 3,
    CATASTROPHIC = 4,
}

export interface TreatyTermsOnChain {
    partyACVI: string;
    partyBCVI: string;
    minTierA: number;
    minTierB: number;
    amount: bigint;
    interestRate: number;
    duration: bigint;
    collateralRatio: number;
    liquidationThreshold: number;
    monitoredConditions: bigint;
    breachGraceBlocks: bigint;
    renegotiationWindow: bigint;
    maxRenegotiationRounds: number;
    settlementAsset: string;
    penaltyBps: number;
}

// ──── CLIENT ────────────────────────────────────────────

export class TreatyClient {
    private provider: ethers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private treaty: ethers.Contract;
    private constitution: ethers.Contract;
    private mediator: ethers.Contract;
    private config: ConcordConfig;

    constructor(config: ConcordConfig) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.agentPrivateKey, this.provider);
        
        this.treaty = new ethers.Contract(config.treatyContract, TREATY_ABI, this.signer);
        this.constitution = new ethers.Contract(config.constitutionRegistry, CONSTITUTION_ABI, this.signer);
        this.mediator = new ethers.Contract(config.mediatorSwarm, MEDIATOR_ABI, this.signer);
    }

    // ──── TREATY LIFECYCLE ──────────────────────────────

    async proposeTreaty(
        counterparty: string,
        terms: TreatyTermsOnChain
    ): Promise<string> {
        const tx = await this.treaty.proposeTreaty(counterparty, terms);
        const receipt = await tx.wait();
        // Parse treatyId from event
        const event = receipt.logs.find(
            (log: any) => log.fragment?.name === "TreatyProposed"
        );
        return event?.args?.treatyId || "";
    }

    async acceptNegotiation(treatyId: string): Promise<void> {
        const tx = await this.treaty.acceptNegotiation(treatyId);
        await tx.wait();
    }

    async finalizeNegotiation(treatyId: string): Promise<void> {
        const tx = await this.treaty.finalizeNegotiation(treatyId);
        await tx.wait();
    }

    async activateTreaty(treatyId: string): Promise<void> {
        const tx = await this.treaty.activateTreaty(treatyId);
        await tx.wait();
    }

    // ──── MONITORING ────────────────────────────────────

    async recordAttestation(
        treatyId: string,
        conditionsBitmap: bigint,
        blake3Hash: string,
        newState: TreatyState,
        reason: string,
        breachTier: BreachTier
    ): Promise<void> {
        try {
            const tx = await this.treaty.recordAttestation(
                treatyId,
                conditionsBitmap,
                blake3Hash,
                newState,
                reason,
                breachTier
            );
            await tx.wait();
        } catch (err) {
            console.error(`[TreatyClient] recordAttestation failed for ${treatyId}:`, err);
        }
    }

    // ──── RENEGOTIATION ─────────────────────────────────

    async initiateRenegotiation(
        treatyId: string,
        newTerms: TreatyTermsOnChain
    ): Promise<void> {
        const tx = await this.treaty.initiateRenegotiation(treatyId, newTerms);
        await tx.wait();
    }

    async acceptRenegotiation(
        treatyId: string,
        amendmentHash: string
    ): Promise<void> {
        const tx = await this.treaty.acceptRenegotiation(treatyId, amendmentHash);
        await tx.wait();
    }

    // ──── BREACH RESOLUTION ─────────────────────────────

    async resolveBreach(
        treatyId: string,
        settlementAmount: bigint,
        toNonBreachingParty: boolean,
        penaltyAmount: bigint
    ): Promise<void> {
        // This is called by MediatorSwarm, not the monitor agent directly
        const mediatorSigner = this.signer; // In production: separate mediator wallet
        const mediatorContract = new ethers.Contract(
            this.config.mediatorSwarm,
            MEDIATOR_ABI,
            mediatorSigner
        );
        const tx = await this.treaty.resolveBreach(
            treatyId,
            settlementAmount,
            toNonBreachingParty,
            penaltyAmount
        );
        await tx.wait();
    }

    async executeSettlement(treatyId: string): Promise<void> {
        const tx = await this.treaty.executeSettlement(treatyId);
        await tx.wait();
    }

    // ──── VIEWS ─────────────────────────────────────────

    async getTreatyState(treatyId: string): Promise<any> {
        return this.treaty.getTreatyState(treatyId);
    }

    async getTreatyHealth(treatyId: string): Promise<{ health: number; status: string }> {
        const [health, status] = await this.treaty.getTreatyHealth(treatyId);
        return { health: Number(health), status };
    }

    async getActiveTreaties(): Promise<string[]> {
        const count = await this.treaty.getActiveTreatyCount();
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            ids.push(await this.treaty.treatyIds(i));
        }
        return ids;
    }

    // ──── CONSTITUTION ──────────────────────────────────

    async validateConstitution(
        agent: string,
        termsHash: string
    ): Promise<{ isValid: boolean; violations: number }> {
        const [isValid, violations] = await this.constitution.validateTreatyTerms(
            agent,
            termsHash
        );
        return { isValid, violations: Number(violations) };
    }

    async meetsTierRequirement(agent: string, minTier: number): Promise<boolean> {
        return this.constitution.meetsTierRequirement(agent, minTier);
    }

    // ──── MEDIATOR ──────────────────────────────────────

    async startConsensus(
        treatyId: string,
        consensusType: number,
        evidenceHash: string
    ): Promise<number> {
        const tx = await this.mediator.startConsensus(treatyId, consensusType, evidenceHash);
        const receipt = await tx.wait();
        const event = receipt.logs.find(
            (log: any) => log.fragment?.name === "ConsensusStarted"
        );
        return Number(event?.args?.round || 0);
    }

    async castVote(
        treatyId: string,
        round: number,
        verdict: number,
        reasoning: string
    ): Promise<void> {
        const tx = await this.mediator.castVote(treatyId, round, verdict, reasoning);
        await tx.wait();
    }

    async checkConsensus(
        treatyId: string,
        round: number
    ): Promise<{ complete: boolean; verdict: number; fairnessScore: number }> {
        const [complete, verdict, fairnessScore] = await this.mediator.isConsensusReached(
            treatyId,
            round
        );
        return { complete, verdict: Number(verdict), fairnessScore: Number(fairnessScore) };
    }
}
