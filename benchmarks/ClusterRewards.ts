import { ethers, upgrades } from "hardhat";
import { benchmarkDeployment } from "./helpers/deployment";

describe("Cluster Rewards", async () => {
    async function deployClusterRewardsFixture() {
        const signers = await ethers.getSigners();
        const addrs = await Promise.all(signers.map((a) => a.getAddress()));

        const blockNum = await ethers.provider.getBlockNumber();
        const blockData = await ethers.provider.getBlock(blockNum);

        const Pond = await ethers.getContractFactory("Pond");
        const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
            kind: "uups",
        });

        const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
        const receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
            constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
            kind: "uups",
            initializer: false,
        });

        await receiverStaking.initialize(addrs[0]);

        const EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
        const epochSelector = await upgrades.deployProxy(EpochSelector, [
            addrs[0], "0x000000000000000000000000000000000000dEaD", 5, pond.address, ethers.utils.parseEther("1").toString()
        ], {
            kind: "uups",
            constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
        });

        const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
        const clusterRewards = await upgrades.deployProxy(
            ClusterRewards,
            [
                addrs[0],
                addrs[1],
                receiverStaking.address,
                [ethers.utils.id("ETH"), ethers.utils.id("DOT"), ethers.utils.id("NEAR")],
                [100,  200, 300],
                [
                    "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
                    epochSelector.address,
                    "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
                ],
                60000,
            ],
            { kind: "uups" }
        );

        return {
            receiverStaking,
            epochSelector,
            clusterRewards
        };
    }

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
});