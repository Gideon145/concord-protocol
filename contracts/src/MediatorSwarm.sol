// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MediatorSwarm
 * @notice 3-agent consensus mechanism for treaty fairness evaluation and breach resolution.
 * @dev Three independent AI agents evaluate treaty proposals, renegotiations,
 *      and breach resolutions. 2/3 consensus required for a verdict.
 *      Inspired by TriMind (OKX Build-X 2nd Place) multi-AI consensus pattern.
 */
contract MediatorSwarm {
    // ──── TYPES ────────────────────────────────────────────

    enum ConsensusType {
        FAIRNESS_EVALUATION,    // Evaluating treaty/renegotiation fairness
        BREACH_RESOLUTION,      // Resolving a breach
        ARBITRATION             // Full arbitration for catastrophic breaches
    }

    enum Verdict {
        NOT_VOTED,              // Agent hasn't voted yet
        APPROVE,                // Agent approves the proposal
        REJECT,                 // Agent rejects the proposal
        ABSTAIN                 // Agent abstains (counts as neither approve nor reject)
    }

    struct MediatorAgent {
        address agentAddress;   // AI agent's wallet
        string  name;           // Human-readable name (Med-1, Med-2, Med-3)
        string  specialty;      // "market_fairness", "risk_assessment", "historical_analysis"
        uint256 reputation;     // ELO-based reputation score
        uint256 casesResolved;  // Total cases handled
        uint256 consensusRate;  // Percentage of cases where this agent agreed with majority
        bool    isActive;
    }

    struct ConsensusRound {
        bytes32 treatyId;
        ConsensusType consensusType;
        uint256 round;
        uint256 startedAt;
        uint256 deadline;
        bool    isComplete;
        Verdict finalVerdict;
        uint256 fairnessScore;      // 0-100, only for FAIRNESS_EVALUATION
        string  resolutionDetails;  // Human-readable resolution
        bytes32 evidenceHash;       // Blake3 of all evidence considered
    }

    struct AgentVote {
        Verdict verdict;
        uint256 timestamp;
        string  reasoning;          // Agent's reasoning for its vote
        bytes32 reasoningHash;      // keccak256 of reasoning (for on-chain storage)
    }

    // ──── STORAGE ────────────────────────────────────────────

    // Mediator agents (fixed at 3)
    MediatorAgent[3] public mediators;

    // Consensus rounds: treatyId → roundNumber → ConsensusRound
    mapping(bytes32 => mapping(uint256 => ConsensusRound)) public consensusRounds;

    // Agent votes: treatyId → roundNumber → agentIndex → AgentVote
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => AgentVote))) public votes;

    // Round counter per treaty
    mapping(bytes32 => uint256) public roundCounters;

    // TreatyContract reference
    address public treatyContract;

    // ConstitutionRegistry reference
    address public constitutionRegistry;

    address public owner;

    // ──── EVENTS ────────────────────────────────────────────

    event MediatorRegistered(uint256 index, address agent, string name, string specialty);
    event ConsensusStarted(bytes32 indexed treatyId, uint256 round, ConsensusType cType);
    event VoteCast(bytes32 indexed treatyId, uint256 round, uint256 agentIndex, Verdict verdict);
    event ConsensusReached(bytes32 indexed treatyId, uint256 round, Verdict verdict, uint256 fairnessScore);
    event ConsensusFailed(bytes32 indexed treatyId, uint256 round, string reason);
    event ReputationUpdated(uint256 agentIndex, uint256 newReputation);

    // ──── MODIFIERS ────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMediator() {
        bool isMediator = false;
        for (uint256 i = 0; i < 3; i++) {
            if (mediators[i].agentAddress == msg.sender && mediators[i].isActive) {
                isMediator = true;
                break;
            }
        }
        require(isMediator, "Only active mediator agent");
        _;
    }

    modifier onlyTreatyContract() {
        require(msg.sender == treatyContract, "Only TreatyContract");
        _;
    }

    // ──── CONSTRUCTOR ────────────────────────────────────────────

    constructor(address _treatyContract, address _constitutionRegistry) {
        owner = msg.sender;
        treatyContract = _treatyContract;
        constitutionRegistry = _constitutionRegistry;
    }

    // ──── MEDIATOR REGISTRATION ────────────────────────────────────────

    /**
     * @notice Register the three mediator agents. Called once during setup.
     */
    function registerMediators(
        address[3] calldata _addresses,
        string[3] calldata _names,
        string[3] calldata _specialties
    ) external onlyOwner {
        for (uint256 i = 0; i < 3; i++) {
            require(_addresses[i] != address(0), "Invalid address");
            mediators[i] = MediatorAgent({
                agentAddress: _addresses[i],
                name: _names[i],
                specialty: _specialties[i],
                reputation: 1500,    // Starting ELO
                casesResolved: 0,
                consensusRate: 100,  // Start optimistic
                isActive: true
            });
            emit MediatorRegistered(i, _addresses[i], _names[i], _specialties[i]);
        }
    }

    // ──── CONSENSUS INITIATION ────────────────────────────────────────

    /**
     * @notice Start a new consensus round. Called by TreatyContract or Monitor Agent.
     * @param treatyId The treaty under evaluation
     * @param _consensusType Type of consensus needed
     * @param _evidenceHash Blake3 hash of all evidence
     * @return roundNumber The round identifier
     */
    function startConsensus(
        bytes32 treatyId,
        ConsensusType _consensusType,
        bytes32 _evidenceHash
    )
        external
        returns (uint256 roundNumber)
    {
        require(
            msg.sender == treatyContract || msg.sender == owner,
            "Only TreatyContract or owner"
        );

        roundNumber = roundCounters[treatyId];
        roundCounters[treatyId]++;

        consensusRounds[treatyId][roundNumber] = ConsensusRound({
            treatyId: treatyId,
            consensusType: _consensusType,
            round: roundNumber,
            startedAt: block.timestamp,
            deadline: block.timestamp + 1 hours,
            isComplete: false,
            finalVerdict: Verdict.NOT_VOTED,
            fairnessScore: 0,
            resolutionDetails: "",
            evidenceHash: _evidenceHash
        });

        emit ConsensusStarted(treatyId, roundNumber, _consensusType);
    }

    // ──── VOTING ──────────────────────────────────────────────────────

    /**
     * @notice A mediator agent casts its vote.
     * @param treatyId Treaty being evaluated
     * @param _round Consensus round number
     * @param _verdict Agent's verdict
     * @param _reasoning Brief reasoning for the vote
     */
    function castVote(
        bytes32 treatyId,
        uint256 _round,
        Verdict _verdict,
        string calldata _reasoning
    )
        external
        onlyMediator
    {
        ConsensusRound storage cr = consensusRounds[treatyId][_round];
        require(!cr.isComplete, "Round already complete");
        require(block.timestamp < cr.deadline, "Round deadline passed");

        // Find mediator index
        uint256 mediatorIndex = 3; // sentinel
        for (uint256 i = 0; i < 3; i++) {
            if (mediators[i].agentAddress == msg.sender) {
                mediatorIndex = i;
                break;
            }
        }
        require(mediatorIndex < 3, "Not a registered mediator");

        // Can't vote twice
        require(
            votes[treatyId][_round][mediatorIndex].verdict == Verdict.NOT_VOTED,
            "Already voted"
        );

        votes[treatyId][_round][mediatorIndex] = AgentVote({
            verdict: _verdict,
            timestamp: block.timestamp,
            reasoning: _reasoning,
            reasoningHash: keccak256(abi.encodePacked(_reasoning))
        });

        emit VoteCast(treatyId, _round, mediatorIndex, _verdict);

        // Check if consensus reached
        _checkConsensus(treatyId, _round);
    }

    // ──── CONSENSUS EVALUATION ────────────────────────────────────────

    /**
     * @dev Internal: check if 2/3 consensus is reached and finalize round.
     */
    function _checkConsensus(bytes32 treatyId, uint256 _round) internal {
        ConsensusRound storage cr = consensusRounds[treatyId][_round];

        uint256 approveCount;
        uint256 rejectCount;
        uint256 votedCount;

        for (uint256 i = 0; i < 3; i++) {
            Verdict v = votes[treatyId][_round][i].verdict;
            if (v == Verdict.APPROVE) approveCount++;
            else if (v == Verdict.REJECT) rejectCount++;
            if (v != Verdict.NOT_VOTED) votedCount++;
        }

        // Need all 3 to have voted
        if (votedCount < 3) return;

        cr.isComplete = true;

        // 2/3 consensus
        if (approveCount >= 2) {
            cr.finalVerdict = Verdict.APPROVE;
            // Update mediator reputations: approvers gain, dissenter loses
            _updateReputations(treatyId, _round, true);
            emit ConsensusReached(treatyId, _round, Verdict.APPROVE, cr.fairnessScore);
        } else if (rejectCount >= 2) {
            cr.finalVerdict = Verdict.REJECT;
            _updateReputations(treatyId, _round, false);
            emit ConsensusReached(treatyId, _round, Verdict.REJECT, 0);
        } else {
            // 1 approve + 1 reject + 1 abstain → no consensus
            cr.finalVerdict = Verdict.ABSTAIN;
            emit ConsensusFailed(treatyId, _round, "No 2/3 majority reached");
        }
    }

    /**
     * @dev Update mediator reputations using simplified ELO.
     *      Agents on the winning side gain rep; losing side loses rep.
     */
    function _updateReputations(bytes32 treatyId, uint256 _round, bool _approveWon) internal {
        Verdict winningVerdict = _approveWon ? Verdict.APPROVE : Verdict.REJECT;

        for (uint256 i = 0; i < 3; i++) {
            MediatorAgent storage m = mediators[i];
            Verdict v = votes[treatyId][_round][i].verdict;

            m.casesResolved++;

            if (v == winningVerdict) {
                // Winning side: +16 ELO (K=32 for veterans, K=64 for new)
                uint256 k = m.casesResolved > 30 ? 32 : 64;
                m.reputation += k;
                m.consensusRate = ((m.consensusRate * (m.casesResolved - 1)) + 100) / m.casesResolved;
            } else if (v != Verdict.ABSTAIN) {
                // Losing side: -16 ELO
                uint256 k = m.casesResolved > 30 ? 32 : 64;
                if (m.reputation > k) m.reputation -= k;
                m.consensusRate = ((m.consensusRate * (m.casesResolved - 1)) + 0) / m.casesResolved;
            }

            emit ReputationUpdated(i, m.reputation);
        }
    }

    /**
     * @notice Set the fairness score for a FAIRNESS_EVALUATION round.
     *         Called by any mediator after consensus is reached.
     */
    function setFairnessScore(
        bytes32 treatyId,
        uint256 _round,
        uint256 _score,
        string calldata _resolutionDetails
    )
        external
        onlyMediator
    {
        ConsensusRound storage cr = consensusRounds[treatyId][_round];
        require(cr.isComplete, "Consensus not yet reached");
        require(cr.consensusType == ConsensusType.FAIRNESS_EVALUATION, "Wrong type");
        require(_score <= 100, "Score must be 0-100");

        cr.fairnessScore = _score;
        cr.resolutionDetails = _resolutionDetails;
    }

    // ──── VIEWS ──────────────────────────────────────────────────────

    /**
     * @notice Get consensus round details.
     */
    function getConsensusRound(bytes32 treatyId, uint256 _round)
        external
        view
        returns (ConsensusRound memory)
    {
        return consensusRounds[treatyId][_round];
    }

    /**
     * @notice Get all votes for a consensus round.
     */
    function getRoundVotes(bytes32 treatyId, uint256 _round)
        external
        view
        returns (AgentVote[3] memory)
    {
        AgentVote[3] memory roundVotes;
        for (uint256 i = 0; i < 3; i++) {
            roundVotes[i] = votes[treatyId][_round][i];
        }
        return roundVotes;
    }

    /**
     * @notice Get mediator agent details.
     */
    function getMediator(uint256 _index) external view returns (MediatorAgent memory) {
        require(_index < 3, "Invalid index");
        return mediators[_index];
    }

    /**
     * @notice Get all mediator agents.
     */
    function getAllMediators() external view returns (MediatorAgent[3] memory) {
        return mediators;
    }

    /**
     * @notice Check if consensus has been reached for a round.
     */
    function isConsensusReached(bytes32 treatyId, uint256 _round)
        external
        view
        returns (bool complete, Verdict finalVerdict, uint256 fairnessScore)
    {
        ConsensusRound storage cr = consensusRounds[treatyId][_round];
        return (cr.isComplete, cr.finalVerdict, cr.fairnessScore);
    }

    // ──── ADMIN ────────────────────────────────────────────────────────

    function setTreatyContract(address _treatyContract) external onlyOwner {
        treatyContract = _treatyContract;
    }

    function deactivateMediator(uint256 _index) external onlyOwner {
        require(_index < 3, "Invalid index");
        mediators[_index].isActive = false;
    }

    function activateMediator(uint256 _index) external onlyOwner {
        require(_index < 3, "Invalid index");
        mediators[_index].isActive = true;
    }
}
