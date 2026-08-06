// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ConstitutionRegistry
 * @notice On-chain registry of immutable constitutional rules for AI agents.
 * @dev Each agent has up to 10 immutable laws stored as keccak256 hashes.
 *      Once sealed, rules cannot be modified — enforcing trustworthy autonomy.
 *      Inspired by BUILD4 ConstitutionRegistry pattern.
 *      Used by TreatyContract for bilateral constitutional validation.
 */
contract ConstitutionRegistry {
    // ──── TYPES ────────────────────────────────────────────

    struct ConstitutionalRule {
        bytes32 ruleHash;       // keccak256 of the rule text
        string  description;    // Human-readable rule description
        uint256 sealedAt;       // Block number when sealed
    }

    struct AgentConstitution {
        address agent;                      // Agent wallet address
        bytes32 cviCredential;              // Cleanverse CVI credential reference
        uint8   cviTier;                    // Agent's CVI tier at time of sealing
        ConstitutionalRule[] rules;         // Up to 10 immutable rules
        bool    isSealed;                   // Once true, rules cannot change
        uint256 sealedAt;                   // Block number of sealing
        uint256 version;                    // Constitution version (monotonic)
    }

    // ──── STORAGE ────────────────────────────────────────────

    mapping(address => AgentConstitution) public constitutions;
    address[] public registeredAgents;

    // Maximum rules per constitution
    uint256 public constant MAX_RULES = 10;

    // TreatyContract reference
    address public treatyContract;

    address public owner;

    // ──── EVENTS ────────────────────────────────────────────

    event ConstitutionSealed(address indexed agent, bytes32 cviCredential, uint256 ruleCount);
    event RuleAdded(address indexed agent, bytes32 ruleHash, string description);
    event AgentRegistered(address indexed agent, bytes32 cviCredential, uint8 cviTier);

    // ──── MODIFIERS ────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAgent() {
        require(constitutions[msg.sender].isSealed || constitutions[msg.sender].agent == msg.sender,
            "Agent not registered");
        _;
    }

    modifier notSealed(address agent) {
        require(!constitutions[agent].isSealed, "Constitution is sealed");
        _;
    }

    // ──── CONSTRUCTOR ────────────────────────────────────────────

    constructor(address _treatyContract) {
        owner = msg.sender;
        treatyContract = _treatyContract;
    }

    // ──── REGISTRATION ────────────────────────────────────────────

    /**
     * @notice Register an agent with its CVI credential.
     * @param _cviCredential Cleanverse CVI credential reference
     * @param _cviTier Agent's CVI tier level
     */
    function registerAgent(bytes32 _cviCredential, uint8 _cviTier) external {
        require(!constitutions[msg.sender].isSealed, "Already registered and sealed");
        require(_cviTier > 0, "Invalid CVI tier");

        AgentConstitution storage c = constitutions[msg.sender];
        c.agent = msg.sender;
        c.cviCredential = _cviCredential;
        c.cviTier = _cviTier;
        c.version = 1;

        registeredAgents.push(msg.sender);

        emit AgentRegistered(msg.sender, _cviCredential, _cviTier);
    }

    // ──── RULE MANAGEMENT ────────────────────────────────────────────

    /**
     * @notice Add a constitutional rule. Cannot exceed MAX_RULES.
     * @param _ruleDescription Human-readable description
     * @param _ruleText Full text of the rule
     */
    function addRule(string calldata _ruleDescription, string calldata _ruleText)
        external
        notSealed(msg.sender)
    {
        AgentConstitution storage c = constitutions[msg.sender];
        require(c.agent == msg.sender, "Agent not registered");
        require(c.rules.length < MAX_RULES, "Max rules reached");

        bytes32 ruleHash = keccak256(abi.encodePacked(_ruleText));
        c.rules.push(ConstitutionalRule({
            ruleHash: ruleHash,
            description: _ruleDescription,
            sealedAt: 0 // Will be set when constitution is sealed
        }));

        emit RuleAdded(msg.sender, ruleHash, _ruleDescription);
    }

    /**
     * @notice Seal the constitution. After this, rules are IMMUTABLE.
     *         The agent can never modify its constitution again.
     */
    function sealConstitution() external {
        AgentConstitution storage c = constitutions[msg.sender];
        require(c.agent == msg.sender, "Agent not registered");
        require(!c.isSealed, "Already sealed");
        require(c.rules.length > 0, "Must have at least 1 rule");

        c.isSealed = true;
        c.sealedAt = block.number;

        // Set sealedAt for all rules
        for (uint256 i = 0; i < c.rules.length; i++) {
            c.rules[i].sealedAt = block.number;
        }

        emit ConstitutionSealed(msg.sender, c.cviCredential, c.rules.length);
    }

    // ──── VALIDATION ────────────────────────────────────────────

    /**
     * @notice Validate that treaty terms comply with an agent's constitution.
     *         Called by TreatyContract during VALIDATING phase.
     * @param _agent Agent address
     * @param _termsHash keccak256 of the treaty terms
     * @return isValid True if terms comply with all constitutional rules
     * @return violationsCount Number of rules violated
     */
    function validateTreatyTerms(
        address _agent,
        bytes32 _termsHash
    )
        external
        view
        returns (bool isValid, uint256 violationsCount)
    {
        AgentConstitution storage c = constitutions[_agent];
        require(c.isSealed, "Agent constitution not sealed");

        // For hackathon: simplified validation — check agent is registered and sealed
        // In production: each constitutional rule would be evaluated against treaty terms
        // using a rule engine that interprets keccak256 hashes against structured parameters

        // Placeholder: return true if constitution exists and is sealed
        isValid = c.isSealed && c.rules.length > 0;
        violationsCount = 0;

        // Example rule check (would be expanded in production):
        // Rule: "max_exposure_per_counterparty = 1_000_000 USD"
        // If treaty amount > 1M → violation
    }

    /**
     * @notice Check if an agent meets a minimum CVI tier requirement.
     * @param _agent Agent address
     * @param _minTier Minimum tier required
     * @return qualifies True if agent's tier >= requirement
     */
    function meetsTierRequirement(address _agent, uint8 _minTier)
        external
        view
        returns (bool qualifies)
    {
        AgentConstitution storage c = constitutions[_agent];
        return c.isSealed && c.cviTier >= _minTier;
    }

    // ──── VIEWS ────────────────────────────────────────────

    /**
     * @notice Get an agent's full constitution.
     */
    function getConstitution(address _agent)
        external
        view
        returns (AgentConstitution memory)
    {
        return constitutions[_agent];
    }

    /**
     * @notice Get an agent's rule count.
     */
    function getRuleCount(address _agent) external view returns (uint256) {
        return constitutions[_agent].rules.length;
    }

    /**
     * @notice Get a specific rule by index.
     */
    function getRule(address _agent, uint256 _index)
        external
        view
        returns (ConstitutionalRule memory)
    {
        require(_index < constitutions[_agent].rules.length, "Index out of bounds");
        return constitutions[_agent].rules[_index];
    }

    /**
     * @notice Check if an agent's constitution is sealed.
     */
    function isConstitutionSealed(address _agent) external view returns (bool) {
        return constitutions[_agent].isSealed;
    }

    /**
     * @notice Get all registered agents.
     */
    function getRegisteredAgents() external view returns (address[] memory) {
        return registeredAgents;
    }

    // ──── ADMIN ────────────────────────────────────────────────────────

    function setTreatyContract(address _treatyContract) external onlyOwner {
        treatyContract = _treatyContract;
    }
}
