import { ethers } from "hardhat";
import  { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { benchmark as benchmarkDeployment } from "./helpers/deployment";
import { deployFixture as deployClusterRewardsFixture, initDataFixture } from "./fixtures/ClusterRewards";
import { BigNumber, constants, Contract, Signer } from "ethers";
import { randomlyDivideInXPieces, skipTime } from "./helpers/util";

describe("Cluster Rewards", async () => {

    benchmarkDeployment('ClusterRewards', [], [
        "0x000000000000000000000000000000000000dEaD",
        "0x000000000000000000000000000000000000dEaD",
        "0x000000000000000000000000000000000000dEaD",
        [ethers.utils.id("ETH"), ethers.utils.id("DOT"), ethers.utils.id("NEAR")],
        [100,  200, 300],
        [
            "0x000000000000000000000000000000000000dEaD",
            "0x000000000000000000000000000000000000dEaD",
            "0x000000000000000000000000000000000000dEaD",
        ],
        60000,
    ]);

    describe("issue tickets", async () => {
        let pond: Contract;
        let receiverStaking: Contract;
        let clusterSelector: Contract;
        let clusterRewards: Contract;
        let admin: Signer;
        let rewardDelegatorsMock: Signer;
        let nodesInserted: number;
        let receivers: Signer[];

        const MAX_TICKETS = BigNumber.from(10).pow(18);
        const EPOCH_LENGTH = 4*3600;

        beforeEach(async function() {
            this.timeout(1000000);
            ({
                pond,
                receiverStaking,
                clusterSelector,
                clusterRewards,
                admin,
                rewardDelegatorsMock,
                nodesInserted,
                receivers
            } = await loadFixture(initDataFixture));
        });

        it.only("to single epoch, tickets to 1 - 5 clusters, input clusters ordered", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiver: Signer = receivers[selectedReceiverIndex];

            for(let i=1; i <= 5; i++) {
                // skip first epoch
                await skipTime(EPOCH_LENGTH);

                // select clusters for next epoch
                await clusterSelector.selectClusters();

                // skip to next epoch
                await skipTime(EPOCH_LENGTH);

                let epoch = await clusterSelector.getCurrentEpoch();
                let clusters: string[] = await clusterSelector.getClusters(epoch);
                const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, i);

                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);

                const tx = await clusterRewards.connect(selectedReceiver)["issueTickets(bytes32,uint256,address[],uint256[])"](
                    ethers.utils.id("ETH"), epoch, clusters.slice(0, i), tickets
                );
                const receipt = await tx.wait();
                console.log(`gas used for ${i} cluster : ${receipt.gasUsed.sub(21000).toNumber()}`);
            }
        });

        it("to single epoch, tickets to 1 - 5 clusters, input clusters in random order", async () => {});

        it("multiple epochs (1-6), tickets to 5 clusters", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiver: Signer = receivers[selectedReceiverIndex];

            const selectedClusters: string[][] = [];
            const issuedTickets: BigNumber[][] = [];
            const epochs: number[] = [];

            for(let i=1; i <= 6; i++) {
                // skip first epoch
                await skipTime(EPOCH_LENGTH);

                // select clusters for next epoch
                await clusterSelector.selectClusters();

                // skip to next epoch
                await skipTime(EPOCH_LENGTH);

                let epoch = await clusterSelector.getCurrentEpoch();
                let clusters: string[] = await clusterSelector.getClusters(epoch);
                selectedClusters.push(clusters);
                const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, clusters.length);

                issuedTickets.push(tickets);
                epochs.push(epoch);
                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);

                const tx = await clusterRewards.connect(selectedReceiver)["issueTickets(bytes32,uint256[],address[][],uint256[][])"](
                    ethers.utils.id("ETH"), epochs, selectedClusters, issuedTickets
                );
                const receipt = await tx.wait();
                console.log(`gas used for ${i} epochs : ${receipt.gasUsed.sub(21000).toNumber()}`);
            }
        });
    });

});
