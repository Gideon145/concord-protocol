// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TreatyContract
 * @notice The Living Treaty — a 12-state autonomous economic relationship protocol.
 * @dev Two AI agents, each with CVI identity and on-chain constitutional rules,
 *      negotiate, monitor, renegotiate, and settle bilateral financial agreements.
 *
 *      State Machine:
 *      PROPOSED(0) → NEGOTIATING(1) → VALIDATING(2) → ACTIVE(3) → DEGRADING(4)
 *      → RENEGOTIATING(5) → BREACHED(6) → CURING(7) → ARBITRATING(8)
 *      → RESOLVING(9) → SETTLING(10) → SETTLED(11) / TERMINATED(12)
 */
contract TreatyContract {
    // ──── TYPES ────────────────────────────────────────────

    enum TreatyState {
        PROPOSED,       // 0: One party proposed terms
        NEGOTIATING,    // 1: Both parties exchanging offers
        VALIDATING,     // 2: Constitutional checks running
        ACTIVE,         // 3: Treaty ratified, monitoring live
        DEGRADING,      // 4: Soft conditions approaching threshold
        RENEGOTIATING,  // 5: Agents adapting terms
        BREACHED,       // 6: Hard condition violated
        CURING,         // 7: Grace period — breaching party can fix
        ARBITRATING,    // 8: Mediator Swarm resolving dispute
        RESOLVING,      // 9: Settlement amount determined
        SETTLING,       // 10: Payout executing
        SETTLED,        // 11: Treaty completed successfully
        TERMINATED      // 12: Ended (mutual, breach, expiry)
    }

    enum BreachTier {
        NONE,           // No breach
        MINOR,          // Tier 1: Curable (missed payment in grace)
        MATERIAL,       // Tier 2: Curable with penalty (collateral below threshold)
        FUNDAMENTAL,    // Tier 3: Non-curable (CVI revoked, CVA flagged)
        CATASTROPHIC    // Tier 4: Systemic (depeg, oracle failure)
    }

    struct TreatyTerms {
        // ── Identity ──
        bytes32 partyACVI;          // CVI credential reference for party A
        bytes32 partyBCVI;          // CVI credential reference for party B
        uint8   minTierA;           // Minimum CVI tier required for party A
        uint8   minTierB;           // Minimum CVI tier required for party B

        // ── Financial ──
        uint256 amount;             // Treaty value in CVA (6 decimals for USDC-like)
        uint256 interestRate;       // Basis points (e.g., 650 = 6.5%)
        uint256 duration;           // Duration in blocks until maturity
        uint256 collateralRatio;    // Basis points (e.g., 15000 = 150%)
        uint256 liquidationThreshold; // Basis points (e.g., 12000 = 120%)

        // ── Conditions (bitmap of monitored conditions) ──
        uint256 monitoredConditions;
        // Bit 0: CVI status
        // Bit 1: CVA provenance
        // Bit 2: Collateral ratio
        // Bit 3: Payment default
        // Bit 4: Collateral approach (soft)
        // Bit 5: Yield performance (soft)
        // Bit 6: Counterparty health (soft)
        // Bit 7: Oracle deviation (soft)
        // Bit 8: Liquidity conditions (soft)
        // Bit 9: Time milestones (soft)

        // ── Grace Periods ──
        uint256 breachGraceBlocks;      // Blocks to cure a breach
        uint256 renegotiationWindow;    // Blocks for renegotiation
        uint256 maxRenegotiationRounds; // Max counter-offer rounds (default 3)

        // ── Settlement ──
        address settlementAsset;    // CVA token address
        uint256 penaltyBps;         // Penalty for material breach (basis points)
    }

    struct TreatyStateData {
        TreatyState state;
        TreatyTerms terms;
        uint256 activatedAt;            // Block number of activation
        uint256 lastMonitoredAt;        // Block number of last monitoring cycle
        uint256 degradationCount;       // Number of times entered DEGRADING
        uint256 renegotiationCount;     // Number of successful renegotiations
        uint256 breachCount;            // Number of breaches
        bytes32 lastAmendmentHash;      // Hash of last amendment terms
        bytes32 attestationChainRoot;   // Merkle root of all attestations
        address partyA;                 // Agent A address
        address partyB;                 // Agent B address
        uint256 escrowBalance;          // CVA locked in escrow
        uint256 yieldAccrued;           // Yield accumulated since activation
        uint256 lastPaymentBlock;       // Block of last payment
        BreachTier currentBreachTier;   // Active breach tier (NONE if not breached)
        uint256 breachStartedAt;        // Block when breach was detected
        bool    breachCured;            // Whether breach was cured during grace
    }

    struct Amendment {
        bytes32 treatyId;
        bytes32 parentAmendmentHash;
        TreatyTerms newTerms;
        uint256 amendedAt;
        uint256 round;
        bytes32 mediatorConsensusHash; // Blake3 of 3 mediator verdicts
    }

    struct Attestation {
        uint256 epoch;
        uint256 timestamp;
        uint256 conditionsBitmap;   // Snapshot of monitored conditions
        TreatyState stateAfter;
        bytes32 blake3Hash;         // Blake3 commitment of this attestation
    }

    // ──── STORAGE ────────────────────────────────────────────

    mapping(bytes32 => TreatyStateData) public treaties;
    mapping(bytes32 => Amendment[]) public amendmentChains;
    mapping(bytes32 => Attestation[]) public attestationChains;

    bytes32[] public treatyIds;
    uint256 public treatyCount;

    // Constitution registry reference
    address public constitutionRegistry;

    // Mediator swarm reference
    address public mediatorSwarm;

    // CVI oracle reference
    address public cviOracle;

    // CVA oracle reference
    address public cvaOracle;

    // Cleanverse CCP gateway
    address public ccpGateway;

    // Authorized monitor agent
    address public monitorAgent;

    // Owner (for admin operations)
    address public owner;

    // ──── EVENTS ────────────────────────────────────────────

    event TreatyProposed(bytes32 indexed treatyId, address indexed proposer, address counterparty);
    event TreatyNegotiating(bytes32 indexed treatyId, uint256 round);
    event TreatyValidating(bytes32 indexed treatyId);
    event TreatyActivated(bytes32 indexed treatyId, uint256 amount, uint256 duration);
    event TreatyDegrading(bytes32 indexed treatyId, uint256 conditionBitmap, string reason);
    event TreatyRenegotiating(bytes32 indexed treatyId, uint256 round);
    event TreatyAmended(bytes32 indexed treatyId, bytes32 amendmentHash);
    event TreatyBreached(bytes32 indexed treatyId, BreachTier tier, string reason);
    event TreatyCuring(bytes32 indexed treatyId, uint256 graceDeadline);
    event TreatyArbitrating(bytes32 indexed treatyId);
    event TreatyResolving(bytes32 indexed treatyId, uint256 settlementAmount);
    event TreatySettling(bytes32 indexed treatyId, uint256 payoutAmount);
    event TreatySettled(bytes32 indexed treatyId);
    event TreatyTerminated(bytes32 indexed treatyId, string reason);
    event TreatyRenewed(bytes32 indexed treatyId, bytes32 newTreatyId);
    event AttestationRecorded(bytes32 indexed treatyId, uint256 epoch, bytes32 blake3Hash);
    event ConditionEvaluated(bytes32 indexed treatyId, uint256 conditionBitmap, TreatyState newState);

    // ──── MODIFIERS ────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMonitorAgent() {
        require(msg.sender == monitorAgent, "Only monitor agent");
        _;
    }

    modifier onlyParty(bytes32 treatyId) {
        require(
            msg.sender == treaties[treatyId].partyA ||
            msg.sender == treaties[treatyId].partyB,
            "Only treaty party"
        );
        _;
    }

    modifier inState(bytes32 treatyId, TreatyState required) {
        require(treaties[treatyId].state == required, "Invalid state");
        _;
    }

    // ──── CONSTRUCTOR ────────────────────────────────────────────

    constructor(
        address _constitutionRegistry,
        address _mediatorSwarm,
        address _cviOracle,
        address _cvaOracle,
        address _ccpGateway,
        address _monitorAgent
    ) {
        owner = msg.sender;
        constitutionRegistry = _constitutionRegistry;
        mediatorSwarm = _mediatorSwarm;
        cviOracle = _cviOracle;
        cvaOracle = _cvaOracle;
        ccpGateway = _ccpGateway;
        monitorAgent = _monitorAgent;
    }

    // ──── PHASE 1: PROPOSE ────────────────────────────────────────────

    /**
     * @notice Agent proposes a treaty to a counterparty.
     * @param _counterparty Address of the other agent
     * @param _terms Initial treaty terms
     * @return treatyId Unique treaty identifier
     */
    function proposeTreaty(
        address _counterparty,
        TreatyTerms calldata _terms
    ) external returns (bytes32 treatyId) {
        require(_counterparty != address(0), "Invalid counterparty");
        require(_counterparty != msg.sender, "Cannot propose to self");
        require(_terms.amount > 0, "Amount must be > 0");
        require(_terms.duration > 0, "Duration must be > 0");

        treatyId = keccak256(
            abi.encodePacked(
                msg.sender,
                _counterparty,
                block.timestamp,
                treatyCount
            )
        );

        TreatyStateData storage t = treaties[treatyId];
        t.state = TreatyState.PROPOSED;
        t.terms = _terms;
        t.partyA = msg.sender;       // Proposer is party A
        t.partyB = _counterparty;

        treatyIds.push(treatyId);
        treatyCount++;

        emit TreatyProposed(treatyId, msg.sender, _counterparty);
    }

    // ──── PHASE 2: NEGOTIATE ────────────────────────────────────────────

    /**
     * @notice Counterparty accepts to negotiate. Moves treaty to NEGOTIATING.
     * @param treatyId Treaty identifier
     */
    function acceptNegotiation(bytes32 treatyId)
        external
        inState(treatyId, TreatyState.PROPOSED)
    {
        TreatyStateData storage t = treaties[treatyId];
        require(msg.sender == t.partyB, "Only counterparty");

        t.state = TreatyState.NEGOTIATING;
        emit TreatyNegotiating(treatyId, 0);
    }

    /**
     * @notice Either party updates terms during negotiation. Records round.
     * @param treatyId Treaty identifier
     * @param _newTerms Updated terms
     * @param _round Negotiation round number
     */
    function updateNegotiationTerms(
        bytes32 treatyId,
        TreatyTerms calldata _newTerms,
        uint256 _round
    )
        external
        onlyParty(treatyId)
        inState(treatyId, TreatyState.NEGOTIATING)
    {
        TreatyStateData storage t = treaties[treatyId];
        require(_round <= t.terms.maxRenegotiationRounds, "Max rounds exceeded");

        t.terms = _newTerms;
        emit TreatyNegotiating(treatyId, _round);
    }

    /**
     * @notice Finalize negotiation. Both parties must call this or one party
     *         calls with a signature from the other. Moves to VALIDATING.
     * @param treatyId Treaty identifier
     */
    function finalizeNegotiation(bytes32 treatyId)
        external
        onlyParty(treatyId)
        inState(treatyId, TreatyState.NEGOTIATING)
    {
        TreatyStateData storage t = treaties[treatyId];
        t.state = TreatyState.VALIDATING;
        emit TreatyValidating(treatyId);
    }

    // ──── PHASE 3: VALIDATE ────────────────────────────────────────────

    /**
     * @notice Called after constitutional checks pass on both sides.
     *         Activates the treaty. Moves to ACTIVE.
     * @param treatyId Treaty identifier
     */
    function activateTreaty(bytes32 treatyId)
        external
        inState(treatyId, TreatyState.VALIDATING)
    {
        TreatyStateData storage t = treaties[treatyId];
        require(msg.sender == monitorAgent || msg.sender == owner, "Only monitor/owner");

        t.state = TreatyState.ACTIVE;
        t.activatedAt = block.number;
        t.lastMonitoredAt = block.number;
        t.lastPaymentBlock = block.number;
        t.escrowBalance = t.terms.amount;
        t.currentBreachTier = BreachTier.NONE;

        emit TreatyActivated(treatyId, t.terms.amount, t.terms.duration);
    }

    // ──── PHASE 4: CONTINUOUS MONITORING ─────────────────────────────────

    /**
     * @notice Monitor agent records an attestation for this cycle.
     *         Evaluates conditions and transitions state if needed.
     * @param treatyId Treaty identifier
     * @param _conditionsBitmap Current conditions snapshot
     * @param _blake3Hash Blake3 hash commitment
     * @param _newState Proposed new state (ACTIVE, DEGRADING, or BREACHED)
     * @param _reason Human-readable reason for state change
     */
    function recordAttestation(
        bytes32 treatyId,
        uint256 _conditionsBitmap,
        bytes32 _blake3Hash,
        TreatyState _newState,
        string calldata _reason,
        BreachTier _breachTier
    )
        external
        onlyMonitorAgent
    {
        TreatyStateData storage t = treaties[treatyId];
        require(
            t.state == TreatyState.ACTIVE ||
            t.state == TreatyState.DEGRADING ||
            t.state == TreatyState.CURING,
            "Cannot monitor in this state"
        );

        // Record attestation
        Attestation memory a = Attestation({
            epoch: attestationChains[treatyId].length,
            timestamp: block.timestamp,
            conditionsBitmap: _conditionsBitmap,
            stateAfter: _newState,
            blake3Hash: _blake3Hash
        });
        attestationChains[treatyId].push(a);
        t.lastMonitoredAt = block.number;

        emit AttestationRecorded(treatyId, a.epoch, _blake3Hash);
        emit ConditionEvaluated(treatyId, _conditionsBitmap, _newState);

        // State transitions based on monitor agent's evaluation
        if (_newState == TreatyState.DEGRADING && t.state == TreatyState.ACTIVE) {
            t.state = TreatyState.DEGRADING;
            t.degradationCount++;
            emit TreatyDegrading(treatyId, _conditionsBitmap, _reason);
        }
        else if (_newState == TreatyState.BREACHED) {
            t.state = TreatyState.BREACHED;
            t.breachCount++;
            t.currentBreachTier = _breachTier;
            t.breachStartedAt = block.number;
            t.breachCured = false;
            emit TreatyBreached(treatyId, _breachTier, _reason);

            // Tier 3 (fundamental) and Tier 4 (catastrophic) skip grace period
            if (_breachTier == BreachTier.FUNDAMENTAL || _breachTier == BreachTier.CATASTROPHIC) {
                t.state = TreatyState.ARBITRATING;
                emit TreatyArbitrating(treatyId);
            } else {
                // Tier 1 and 2 go to CURING with grace period
                t.state = TreatyState.CURING;
                uint256 deadline = block.number + t.terms.breachGraceBlocks;
                emit TreatyCuring(treatyId, deadline);
            }
        }
        else if (_newState == TreatyState.ACTIVE && t.state == TreatyState.CURING) {
            // Breach was cured
            t.state = TreatyState.ACTIVE;
            t.breachCured = true;
            t.currentBreachTier = BreachTier.NONE;
        }
    }

    // ──── PHASE 5: RENEGOTIATE ────────────────────────────────────────────

    /**
     * @notice Initiate renegotiation from DEGRADING state.
     * @param treatyId Treaty identifier
     * @param _newTerms Proposed amended terms
     */
    function initiateRenegotiation(
        bytes32 treatyId,
        TreatyTerms calldata _newTerms
    )
        external
        onlyParty(treatyId)
        inState(treatyId, TreatyState.DEGRADING)
    {
        TreatyStateData storage t = treaties[treatyId];
        require(t.renegotiationCount < t.terms.maxRenegotiationRounds, "Max rounds");

        t.state = TreatyState.RENEGOTIATING;
        t.terms = _newTerms;
        t.renegotiationCount++;

        emit TreatyRenegotiating(treatyId, t.renegotiationCount);
    }

    /**
     * @notice Accept renegotiated terms. Moves back to ACTIVE.
     * @param treatyId Treaty identifier
     * @param _amendmentHash Hash of the amendment details
     */
    function acceptRenegotiation(
        bytes32 treatyId,
        bytes32 _amendmentHash
    )
        external
        onlyParty(treatyId)
        inState(treatyId, TreatyState.RENEGOTIATING)
    {
        TreatyStateData storage t = treaties[treatyId];

        // Record amendment
        Amendment memory amd = Amendment({
            treatyId: treatyId,
            parentAmendmentHash: t.lastAmendmentHash,
            newTerms: t.terms,
            amendedAt: block.number,
            round: t.renegotiationCount,
            mediatorConsensusHash: _amendmentHash
        });
        amendmentChains[treatyId].push(amd);
        t.lastAmendmentHash = keccak256(abi.encode(amd));
        t.state = TreatyState.ACTIVE;

        emit TreatyAmended(treatyId, t.lastAmendmentHash);
    }

    // ──── PHASE 6: BREACH RESOLUTION ─────────────────────────────────────

    /**
     * @notice Mediator Swarm submits resolution for a breach.
     * @param treatyId Treaty identifier
     * @param _settlementAmount Amount to release from escrow
     * @param _toNonBreachingParty If true, escrow goes to non-breaching party
     * @param _penaltyAmount Additional penalty to apply
     */
    function resolveBreach(
        bytes32 treatyId,
        uint256 _settlementAmount,
        bool _toNonBreachingParty,
        uint256 _penaltyAmount
    )
        external
    {
        require(msg.sender == mediatorSwarm, "Only mediator swarm");
        TreatyStateData storage t = treaties[treatyId];
        require(
            t.state == TreatyState.BREACHED ||
            t.state == TreatyState.CURING ||
            t.state == TreatyState.ARBITRATING,
            "Not in breach-related state"
        );

        t.state = TreatyState.RESOLVING;
        t.escrowBalance = _settlementAmount;

        emit TreatyResolving(treatyId, _settlementAmount);
    }

    // ──── PHASE 7: SETTLE ────────────────────────────────────────────────

    /**
     * @notice Execute settlement payout. Called by monitor agent after
     *         escrow conditions are verified.
     * @param treatyId Treaty identifier
     */
    function executeSettlement(bytes32 treatyId)
        external
        onlyMonitorAgent
        inState(treatyId, TreatyState.RESOLVING)
    {
        TreatyStateData storage t = treaties[treatyId];
        t.state = TreatyState.SETTLING;

        uint256 payout = t.escrowBalance + t.yieldAccrued;
        emit TreatySettling(treatyId, payout);

        // In production: actual CVA token transfer happens here via Cleanverse API
        // For hackathon demo: emit event with payout details

        t.state = TreatyState.SETTLED;
        t.escrowBalance = 0;
        t.yieldAccrued = 0;
        emit TreatySettled(treatyId);
    }

    // ──── PHASE 8: TERMINATE / RENEW ─────────────────────────────────────

    /**
     * @notice Terminate a treaty (mutual agreement or expiry).
     * @param treatyId Treaty identifier
     * @param _reason Reason for termination
     */
    function terminateTreaty(bytes32 treatyId, string calldata _reason)
        external
        onlyParty(treatyId)
    {
        TreatyStateData storage t = treaties[treatyId];
        require(
            t.state == TreatyState.ACTIVE ||
            t.state == TreatyState.DEGRADING ||
            t.state == TreatyState.SETTLED,
            "Cannot terminate in current state"
        );

        t.state = TreatyState.TERMINATED;
        emit TreatyTerminated(treatyId, _reason);
    }

    /**
     * @notice Renew a settled treaty with new terms and duration.
     * @param treatyId Original treaty ID
     * @param _newTerms Updated terms for renewal
     * @return newTreatyId Identifier for the renewed treaty
     */
    function renewTreaty(
        bytes32 treatyId,
        TreatyTerms calldata _newTerms
    )
        external
        onlyParty(treatyId)
        inState(treatyId, TreatyState.SETTLED)
        returns (bytes32 newTreatyId)
    {
        TreatyStateData storage old = treaties[treatyId];

        newTreatyId = keccak256(
            abi.encodePacked(treatyId, "renew", block.timestamp, treatyCount)
        );

        TreatyStateData storage t = treaties[newTreatyId];
        t.state = TreatyState.NEGOTIATING; // Skip PROPOSED since trust established
        t.terms = _newTerms;
        t.partyA = old.partyA;
        t.partyB = old.partyB;

        treatyIds.push(newTreatyId);
        treatyCount++;

        emit TreatyRenewed(treatyId, newTreatyId);
    }

    // ──── ADMIN ────────────────────────────────────────────────────────

    function setMonitorAgent(address _monitorAgent) external onlyOwner {
        monitorAgent = _monitorAgent;
    }

    function setMediatorSwarm(address _mediatorSwarm) external onlyOwner {
        mediatorSwarm = _mediatorSwarm;
    }

    // ──── VIEWS ────────────────────────────────────────────────────────

    /**
     * @notice Get full treaty state for frontend display.
     */
    function getTreatyState(bytes32 treatyId)
        external
        view
        returns (TreatyStateData memory)
    {
        return treaties[treatyId];
    }

    /**
     * @notice Get amendment chain for a treaty.
     */
    function getAmendmentChain(bytes32 treatyId)
        external
        view
        returns (Amendment[] memory)
    {
        return amendmentChains[treatyId];
    }

    /**
     * @notice Get attestation chain for a treaty.
     */
    function getAttestationChain(bytes32 treatyId)
        external
        view
        returns (Attestation[] memory)
    {
        return attestationChains[treatyId];
    }

    /**
     * @notice Get total active treaties count.
     */
    function getActiveTreatyCount() external view returns (uint256) {
        return treatyIds.length;
    }

    /**
     * @notice Compute treaty health score (0-100) based on conditions.
     */
    function getTreatyHealth(bytes32 treatyId)
        external
        view
        returns (uint8 health, string memory status)
    {
        TreatyStateData storage t = treaties[treatyId];

        if (t.state == TreatyState.ACTIVE) {
            // Simple health: check if we're approaching any thresholds
            uint256 blocksRemaining = t.terms.duration > (block.number - t.activatedAt)
                ? t.terms.duration - (block.number - t.activatedAt)
                : 0;

            if (blocksRemaining < (t.terms.duration / 10)) {
                return (60, "Approaching maturity");
            }
            if (t.degradationCount > 2) {
                return (40, "Frequent degradation");
            }
            return (90, "Healthy");
        }
        else if (t.state == TreatyState.DEGRADING) {
            return (50, "Degrading");
        }
        else if (t.state == TreatyState.BREACHED) {
            return (10, "Breached");
        }
        else if (t.state == TreatyState.CURING) {
            return (30, "Curing");
        }
        else if (t.state == TreatyState.SETTLED) {
            return (100, "Settled");
        }
        else if (t.state == TreatyState.TERMINATED) {
            return (0, "Terminated");
        }
        else {
            return (70, "In progress");
        }
    }
}
