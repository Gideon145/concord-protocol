// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TreatyContract} from "../src/TreatyContract.sol";
import {ConstitutionRegistry} from "../src/ConstitutionRegistry.sol";
import {MediatorSwarm} from "../src/MediatorSwarm.sol";

/**
 * @title DeployConcord
 * @notice Deploys the full CONCORD protocol: TreatyContract, ConstitutionRegistry, MediatorSwarm.
 * @dev Deploy order matters: ConstitutionRegistry + MediatorSwarm → TreatyContract
 *
 * Usage:
 *   forge script script/DeployConcord.sol:DeployConcord --rpc-url monad_testnet --broadcast
 */
contract DeployConcord is Script {
    function run() external {
        // ── Load deployer ──
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address monitorAgent = vm.envAddress("MONITOR_AGENT_ADDRESS");

        // ── Cleanverse oracle addresses (testnet stubs) ──
        address cviOracle = vm.envOr("CVI_ORACLE", deployer);
        address cvaOracle = vm.envOr("CVA_ORACLE", deployer);
        address ccpGateway = vm.envOr("CCP_GATEWAY", deployer);

        console.log("Deployer:", deployer);
        console.log("Monitor Agent:", monitorAgent);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ConstitutionRegistry (needed by TreatyContract)
        //    Temporary zero address — updated after TreatyContract deploy
        ConstitutionRegistry constitutionRegistry = new ConstitutionRegistry(address(0));
        console.log("ConstitutionRegistry deployed at:", address(constitutionRegistry));

        // 2. Deploy MediatorSwarm (needed by TreatyContract)
        MediatorSwarm mediatorSwarm = new MediatorSwarm(address(0), address(constitutionRegistry));
        console.log("MediatorSwarm deployed at:", address(mediatorSwarm));

        // 3. Deploy TreatyContract (the core)
        TreatyContract treatyContract = new TreatyContract(
            address(constitutionRegistry),
            address(mediatorSwarm),
            cviOracle,
            cvaOracle,
            ccpGateway,
            monitorAgent
        );
        console.log("TreatyContract deployed at:", address(treatyContract));

        // 4. Wire up cross-references
        constitutionRegistry.setTreatyContract(address(treatyContract));
        mediatorSwarm.setTreatyContract(address(treatyContract));

        console.log("Cross-references wired.");

        // 5. Register mediator agents (using deployer as placeholder — real agent wallets in production)
        address[3] memory mediatorAddresses = [
            vm.envOr("MEDIATOR_1_ADDRESS", deployer),
            vm.envOr("MEDIATOR_2_ADDRESS", deployer),
            vm.envOr("MEDIATOR_3_ADDRESS", deployer)
        ];
        string[3] memory mediatorNames = ["Med-1", "Med-2", "Med-3"];
        string[3] memory mediatorSpecialties = [
            "market_fairness",
            "risk_assessment",
            "historical_analysis"
        ];
        mediatorSwarm.registerMediators(mediatorAddresses, mediatorNames, mediatorSpecialties);
        console.log("Mediators registered.");

        vm.stopBroadcast();

        // ── Summary ──
        console.log("\n=== CONCORD DEPLOYMENT COMPLETE ===");
        console.log("TreatyContract:      ", address(treatyContract));
        console.log("ConstitutionRegistry:", address(constitutionRegistry));
        console.log("MediatorSwarm:       ", address(mediatorSwarm));
        console.log("Monitor Agent:       ", monitorAgent);
        console.log("CVI Oracle:          ", cviOracle);
        console.log("CVA Oracle:          ", cvaOracle);
        console.log("CCP Gateway:         ", ccpGateway);
    }
}
