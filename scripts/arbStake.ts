import { ethers, upgrades } from "hardhat";
import { BigNumber as BN, Signer, Contract } from "ethers";
import * as fs from "fs";

declare module "ethers" {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18));
};

async function main() {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  var addresses: { [key: string]: { [key: string]: string } } = {};
  if (fs.existsSync("address.json")) {
    addresses = JSON.parse(fs.readFileSync("address.json", "utf8"));
  }

  if (addresses[chainId] === undefined || addresses[chainId]["StakeManager"] === undefined || addresses[chainId]["Pond"] === undefined) {
    console.log("Missing dependencies");
    return;
  }

  let signers = await ethers.getSigners();
  let addrs = await Promise.all(signers.map((a) => a.getAddress()));

  console.log("Signer addrs:", addrs);

  const StakeManager = await ethers.getContractFactory("StakeManager");
  let stakeManager = StakeManager.attach(addresses[chainId]["StakeManager"]);

  const Pond = await ethers.getContractFactory("Pond");
  let pond = Pond.attach(addresses[chainId]["Pond"]);

  let res = await pond.approve(stakeManager.address, 1);
  console.log(res);

  res = await res.wait();
  console.log(res);

  res = await stakeManager.createStashAndDelegate(
    ["0x5802add45f8ec0a524470683e7295faacc853f97cf4a8d3ffbaaf25ce0fd87c4"],
    [1],
    "0x41243e6dfa02efb4e5ecefbd93a99d482c3a74c0"
  );
  console.log(res);

  res = await res.wait();
  console.log(res);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
