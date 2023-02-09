import { ethers } from "hardhat";
import  { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { benchmark as benchmarkDeployment } from "./helpers/deployment";
import { deployFixture as deployClusterRewardsFixture, initDataFixture } from "./fixtures/ClusterRewards";
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
        let epochSelector: Contract;
        let clusterRewards: Contract;
        let admin: Signer;
        let rewardDelegatorsMock: Signer;
        let nodesInserted: number;
        let receivers: Signer[];

        const MAX_TICKETS = BigNumber.from(10).pow(18);
        const EPOCH_LENGTH = 4*3600;

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
                epochSelector,
                clusterRewards,
                admin,
                rewardDelegatorsMock,
                nodesInserted,
                receivers
            } = await loadFixture(initDataFixture));
            console.log((await receivers[0].getAddress()), (await receiverStaking.balanceOf(await receivers[0].getAddress())));
        });

        it("to single epoch, tickets to 1 - 5 clusters, input clusters ordered", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiver: Signer = receivers[selectedReceiverIndex];

            for(let i=1; i <= 5; i++) {
                // skip first epoch
                await skipTime(EPOCH_LENGTH);
                
                // select clusters for next epoch
                await epochSelector.selectClusters();

                // skip to next epoch
                await skipTime(EPOCH_LENGTH);
                
                let epoch = await epochSelector.getCurrentEpoch();
                const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, i);

                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);

                const tx = await clusterRewards.connect(selectedReceiver)["issueTickets(bytes32,uint256,uint256[])"](
                    ethers.utils.id("ETH"), epoch, tickets
                );
                const receipt = await tx.wait();
                console.log(`gas used for ${i} cluster : ${receipt.gasUsed.sub(21000).toNumber()}`);
            }
        });

        it("to single epoch, tickets to 1 - 5 clusters, input clusters in random order", async () => {});

        it("single epochs, 1 receivers signed tickets to all selected clusters each", async () => {
            const noOfReceivers = 1;
            // const selectedReceiverIndex: number = Math.floor(Math.random()*(receivers.length - noOfReceivers));
            const selectedReceivers: Signer[] = receivers.slice(0, noOfReceivers);

            const signedTickets: SignedTicket[] = [];

            for(let i=0; i < selectedReceivers.length; i++) {
                const tickets = randomlyDivideInXPieces(MAX_TICKETS, 5).map(val => val.toString());

                const messageHash = utils.keccak256(utils.defaultAbiCoder.encode(["uint256[]"], [tickets]));
                const signedMessage = await selectedReceivers[i].signMessage(messageHash);
                const splitSig = utils.splitSignature(signedMessage);
                signedTickets[i] = {
                    tickets,
                    v: splitSig.v,
                    r: splitSig.r,
                    s: splitSig.s
                };
            }

            console.log(JSON.stringify(signedTickets, null, 2))

            // skip first epoch
            await skipTime(EPOCH_LENGTH);

            // select clusters for next epoch
            await epochSelector.selectClusters();

            // skip to next epoch
            await skipTime(EPOCH_LENGTH);

            let epoch = await epochSelector.getCurrentEpoch();

            // skip to next epoch so that tickets can be distributed for previous epoch
            await skipTime(EPOCH_LENGTH);

            console.log((await receivers[0].getAddress()), (await receiverStaking.balanceOf(await receivers[0].getAddress())));
            console.log((await receiverStaking.balanceOfAt(await receivers[0].getAddress(), epoch)));
            console.log((await receiverStaking.balanceOfAt(await receivers[0].getAddress(), epoch - 1)));
            // console.log((await receiverStaking.balanceOfAt(await receivers[0].getAddress(), epoch + 1)));

            const tx = await clusterRewards["issueTickets(bytes32,uint256,(uint256[],uint8,bytes32,bytes32)[])"](
                ethers.utils.id("ETH"), epoch, signedTickets
            );

            const receipt = await tx.wait();
            console.log(`gas used : ${receipt.gasUsed.sub(21000).toNumber()}`);

            console.log((await clusterRewards.ticketsIssued((await selectedReceivers[0].getAddress()), epoch)))
            console.log((await clusterRewards.clusterRewards((await epochSelector.getClusters(epoch))[0])))
        });

        it("multiple epochs (1-6), tickets to all selected clusters", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiver: Signer = receivers[selectedReceiverIndex];

            const selectedClusters: string[][] = [];
            const issuedTickets: BigNumber[][] = [];
            const epochs: number[] = [];

            for(let i=1; i <= 6; i++) {
                // skip first epoch
                await skipTime(EPOCH_LENGTH);
                
                // select clusters for next epoch
                await epochSelector.selectClusters();

                // skip to next epoch
                await skipTime(EPOCH_LENGTH);
                
                let epoch = await epochSelector.getCurrentEpoch();
                let clusters: string[] = await epochSelector.getClusters(epoch);
                selectedClusters.push(clusters);
                const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, clusters.length);

                issuedTickets.push(tickets);
                epochs.push(epoch);
                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);

                const tx = await clusterRewards.connect(selectedReceiver)["issueTickets(bytes32,uint256[],uint256[][])"](
                    ethers.utils.id("ETH"), epochs, issuedTickets
                );
                const receipt = await tx.wait();
                console.log(`gas used for ${i} epochs : ${receipt.gasUsed.sub(21000).toNumber()}`);
            }
        });
    });

});