import { ethers, waffle } from "hardhat";
import { benchmark as benchmarkDeployment } from "./helpers/deployment";
import { initDataFixture } from "./fixtures/ClusterRewards";
import { BigNumber, BigNumberish, constants, Contract, PopulatedTransaction, Signer, utils } from "ethers";
import { randomlyDivideInXPieces, skipTime } from "./helpers/util";
import { ClusterRewards, ClusterRewards__factory } from "../typechain-types";
import { IArbGasInfo__factory } from "../typechain-types/factories/contracts/staking/ClusterSelector.sol";

const estimator = new ethers.Contract("0x000000000000000000000000000000000000006c", [
    "function getPricesInArbGas() view returns(uint256 gasPerL2Tx, uint256 gasPerL1CallDataByte, uint256)"
]);
const mainnetProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");

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
        let clusterRewards: ClusterRewards;
        let admin: Signer;
        let rewardDelegatorsMock: Signer;
        let nodesInserted: number;
        let receivers: Signer[];
        let receiverSigners: Signer[];
        let l1GasDetails: any;

        const MAX_TICKETS = BigNumber.from(2).pow(16);
        const DAY = 60*60*24;
        const EPOCH_LENGTH = 15*60;

        interface SignedTicket {
            tickets: BigNumberish[];
            v: number;
            r: string;
            s: string;
        }

        beforeEach(async function() {
            this.timeout(1000000);
            let tempClusterRewards: Contract
            ({
                pond,
                receiverStaking,
                clusterSelector,
                clusterRewards: tempClusterRewards,
                admin,
                rewardDelegatorsMock,
                nodesInserted,
                receivers,
                receiverSigners
            } = await waffle.loadFixture(initDataFixture));

            clusterRewards = ClusterRewards__factory.connect(tempClusterRewards.address, admin)
            l1GasDetails = await estimator.connect(mainnetProvider).getPricesInArbGas();
        });

        it("to single epoch, tickets to 1 - 5 clusters, input clusters ordered", async () => {
            const selectedReceiverIndex: number = Math.floor(Math.random() * receivers.length);
            const selectedReceiverSigner: Signer = receiverSigners[selectedReceiverIndex];

            // skip first epoch
            await skipTime(EPOCH_LENGTH);

            // select clusters for next epoch
            await clusterSelector.selectClusters();

            // skip to next epoch
            await skipTime(EPOCH_LENGTH);

            let epoch = await clusterSelector.getCurrentEpoch();
            const tickets: BigNumber[] = randomlyDivideInXPieces(MAX_TICKETS, 5);

            console.log(tickets.map(a => a.toString()))
            // skip to next epoch so that tickets can be distributed for previous epoch
            await skipTime(EPOCH_LENGTH);

            const gasEstimate = await clusterRewards.connect(selectedReceiverSigner).estimateGas["issueTickets(bytes32,uint24,uint16[])"](
                ethers.utils.id("ETH"), epoch, tickets
            );
            console.log(`gas used for ${5} cluster : ${gasEstimate.toNumber()}`);

            // Todo: estimate call data cost here
            // const tx: PopulatedTransaction = await clusterRewards.connect(selectedReceiverSigner).populateTransaction["issueTickets(bytes32,uint24,uint16[])"](
            //     ethers.utils.id("ETH"), epoch, tickets
            // );

            // const gasData = await IArbGasInfo__factory.connect(estimator.address, selectedReceiverSigner).callStatic.gasEstimateComponents(clusterRewards.address, false, tx.data);
            // console.log(gasData);

        });

        it("single epochs, 50 receivers signed tickets to all selected clusters each", async () => {
            const noOfReceivers = 50;
            // skip first epoch
            await skipTime(EPOCH_LENGTH);

            // select clusters for next epoch
            await clusterSelector.selectClusters();

            // skip to next epoch
            await skipTime(EPOCH_LENGTH);

            let epoch = await clusterSelector.getCurrentEpoch();

            // skip to next epoch so that tickets can be distributed for previous epoch
            await skipTime(EPOCH_LENGTH);

            // const selectedReceiverIndex: number = Math.floor(Math.random()*(receivers.length - noOfReceivers));
            const selectedReceiverSigners: Signer[] = receiverSigners.slice(0, noOfReceivers);

            const signedTickets: SignedTicket[] = [];

            for(let i=0; i < selectedReceiverSigners.length; i++) {
                const tickets = randomlyDivideInXPieces(MAX_TICKETS, 5).map(val => val.toString());
                tickets.pop();

                const messageHash = utils.keccak256(utils.defaultAbiCoder.encode(
                    ["bytes32", "uint256", "uint16[]"], 
                    [ethers.utils.id("ETH"), epoch, tickets]
                ));
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


            // TODO: this function definitation has been removed. Confirm whether to remove it from benchmarks
            // const tx = await clusterRewards["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](
            //     ethers.utils.id("ETH"), epoch, signedTickets
            // );

            // const receipt = await tx.wait();
            // console.log(`gas used : ${receipt.gasUsed.sub(21000).toNumber()}`);
            // console.log(receipt.gasUsed.mul(1600).mul(6).mul(365).div(BigNumber.from(10).pow(10)).toString());
        });

        it("all epochs in a day, tickets to all selected clusters", async function() {
            this.timeout(1000000)
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiverSigner: Signer = receiverSigners[selectedReceiverIndex];

            const selectedClusters: string[][] = [];
            const issuedTickets: BigNumber[][] = [];
            const epochs: BigNumber[] = [];

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
                tickets.pop();

                issuedTickets.push(tickets);
                epochs.push(epoch);
                // skip to next epoch so that tickets can be distributed for previous epoch
                await skipTime(EPOCH_LENGTH);
            }

            const gasEstimate = await clusterRewards.connect(selectedReceiverSigner).estimateGas["issueTickets(bytes32,uint24[],uint16[][])"](
                ethers.utils.id("ETH"), epochs, issuedTickets
            );

            const tx = await clusterRewards.connect(selectedReceiverSigner).populateTransaction["issueTickets(bytes32,uint24[],uint16[][])"](
                ethers.utils.id("ETH"), epochs, issuedTickets
            );
            if(!tx.data) return;
            
            console.log(`gas used for ${DAY/EPOCH_LENGTH} epochs : ${gasEstimate.toNumber()}`);
            console.log("L1 gas cost Per L2 Tx", l1GasDetails.gasPerL2Tx.toNumber(), "L1 Gas cost Per calldata byte", l1GasDetails.gasPerL1CallDataByte.toNumber());
            const l1GasInL2 = l1GasDetails.gasPerL2Tx.add(l1GasDetails.gasPerL1CallDataByte.mul((tx.data.length - 2)/2));
            console.log(`L1 gas used for ${DAY/EPOCH_LENGTH} epochs : ${l1GasInL2.toNumber()}`);

            console.log(gasEstimate.add(l1GasInL2).mul(1600).mul(50).mul(365).div(BigNumber.from(10).pow(10)).toString());
        });

        it("all epochs in a day, tickets to all selected clusters optimized", async function() {
            this.timeout(1000000)
            const selectedReceiverIndex: number = Math.floor(Math.random()*receivers.length);
            const selectedReceiverSigner: Signer = receiverSigners[selectedReceiverIndex];

            let noOfEpochs = DAY/EPOCH_LENGTH;

            // skip first epoch
            await skipTime(EPOCH_LENGTH*3);

            // select clusters for next epoch
            await clusterSelector.selectClusters();
            let epoch = (await clusterSelector.getCurrentEpoch()).toNumber() + 1;

            for(let i=1; i <= noOfEpochs; i++) {
                // skip to next epoch
                await skipTime(EPOCH_LENGTH);

                await clusterSelector.selectClusters();
            }
            // skip to next epoch so that tickets can be distributed for previous epoch
            await skipTime(EPOCH_LENGTH);

            let networkId = ethers.utils.id("ETH");
            let tickets: number[][] = [];
            let rawTicketInfo = networkId + epoch.toString(16).padStart(8, '0');
            for(let i=0; i<noOfEpochs*4; i++) {
                let j: number = parseInt((i/4)+"");
                let k: number = i%4;
                if(!tickets[j]) tickets[j] = [];
                tickets[j][k] = parseInt((Math.random()*13000)+"");
                rawTicketInfo = rawTicketInfo+tickets[j][k].toString(16).padStart(4, '0');
            }

            const gasEstimate = await clusterRewards.connect(selectedReceiverSigner).estimateGas["issueTickets(bytes)"](rawTicketInfo);
            
            console.log(`gas used for ${DAY/EPOCH_LENGTH} epochs : ${gasEstimate.toNumber()}`);

            console.log("L1 gas cost Per L2 Tx", l1GasDetails.gasPerL2Tx.toNumber(), "L1 Gas cost Per calldata byte", l1GasDetails.gasPerL1CallDataByte.toNumber());
            const l1GasInL2 = l1GasDetails.gasPerL2Tx.add(l1GasDetails.gasPerL1CallDataByte.mul((rawTicketInfo.length - 2)/2));
            console.log(`L1 gas used for ${DAY/EPOCH_LENGTH} epochs : ${l1GasInL2.toNumber()}`);

            console.log(gasEstimate.add(l1GasInL2).mul(1600).mul(50).mul(365).div(BigNumber.from(10).pow(10)).toString());
        });
    });

});
