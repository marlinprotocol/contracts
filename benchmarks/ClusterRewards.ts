import { ethers } from "hardhat";
import  { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { benchmark as benchmarkDeployment } from "./helpers/deployment";
import { initDataFixture } from "./fixtures/ClusterRewards";
import { BigNumber, BigNumberish, constants, Contract, Signer, utils } from "ethers";
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
        let receiverSigners: Signer[];

        const MAX_TICKETS = BigNumber.from(10).pow(18);
        const DAY = 60*60*24;
        const EPOCH_LENGTH = 2*60*60;

        interface SignedTicket {
            tickets: BigNumberish[];
            v: number;
            r: string;
            s: string;
        }

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
                receivers,
                receiverSigners
            } = await loadFixture(initDataFixture));
        });

        it("to single epoch, tickets to 1 - 5 clusters, input clusters ordered", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiverSigner: Signer = receiverSigners[selectedReceiverIndex];

            for(let i=1; i <= 5; i++) {
                // skip first epoch
                await skipTime(EPOCH_LENGTH);

                // select clusters for next epoch
                await clusterSelector.selectClusters();

                // skip to next epoch
                await skipTime(EPOCH_LENGTH);

                let epoch = await clusterSelector.getCurrentEpoch();
                const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, i);

                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);

                const tx = await clusterRewards.connect(selectedReceiverSigner)["issueTickets(bytes32,uint256,uint256[])"](
                    ethers.utils.id("ETH"), epoch, tickets
                );
                const receipt = await tx.wait();
                console.log(`gas used for ${i} cluster : ${receipt.gasUsed.sub(21000).toNumber()}`);
            }
        });

        it("single epochs, 50 receivers signed tickets to all selected clusters each", async () => {
            const noOfReceivers = 50;
            // skip first epoch
            await skipTime(EPOCH_LENGTH);

            // select clusters for next epoch
            await epochSelector.selectClusters();

            // skip to next epoch
            await skipTime(EPOCH_LENGTH);

            let epoch = await epochSelector.getCurrentEpoch();

            // skip to next epoch so that tickets can be distributed for previous epoch
            await skipTime(EPOCH_LENGTH);

            // const selectedReceiverIndex: number = Math.floor(Math.random()*(receivers.length - noOfReceivers));
            const selectedReceiverSigners: Signer[] = receiverSigners.slice(0, noOfReceivers);

            const signedTickets: SignedTicket[] = [];

            for(let i=0; i < selectedReceiverSigners.length; i++) {
                const tickets = randomlyDivideInXPieces(MAX_TICKETS, 5).map(val => val.toString());

                const messageHash = utils.keccak256(utils.defaultAbiCoder.encode(["uint256", "uint256[]"], [epoch, tickets]));
                const arrayifyHash = ethers.utils.arrayify(messageHash);
                const signedMessage = await selectedReceiverSigners[i].signMessage(arrayifyHash);
                const splitSig = utils.splitSignature(signedMessage);
                signedTickets[i] = {
                    tickets,
                    v: splitSig.v,
                    r: splitSig.r,
                    s: splitSig.s
                };
            }

            const tx = await clusterRewards["issueTickets(bytes32,uint256,(uint256[],uint8,bytes32,bytes32)[])"](
                ethers.utils.id("ETH"), epoch, signedTickets
            );

            const receipt = await tx.wait();
            console.log(`gas used : ${receipt.gasUsed.sub(21000).toNumber()}`);
            console.log(receipt.gasUsed.mul(1600).mul(6).mul(365).div(BigNumber.from(10).pow(10)).toString());
        });

        it("all epochs in a day, tickets to all selected clusters", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiverSigner: Signer = receiverSigners[selectedReceiverIndex];

            const selectedClusters: string[][] = [];
            const issuedTickets: BigNumber[][] = [];
            const epochs: number[] = [];

            for(let i=1; i <= DAY/EPOCH_LENGTH; i++) {
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
            }

            const tx = await clusterRewards.connect(selectedReceiverSigner)["issueTickets(bytes32,uint256[],uint256[][])"](
                ethers.utils.id("ETH"), epochs, issuedTickets
            );
            const receipt = await tx.wait();
            console.log(`gas used for ${DAY/EPOCH_LENGTH} epochs : ${receipt.gasUsed.sub(21000).toNumber()}`);
            console.log(receipt.gasUsed.mul(1600).mul(50).mul(365).div(BigNumber.from(10).pow(10)).toString());
        });
    });

});
