import { ethers } from "hardhat";
import * as fs from "fs";

// assuming that owner address is passed from arguments
async function main() {
  let owner = process.argv[2];

  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  var addresses: { [key: string]: { [key: string]: string } } = {};
  if (fs.existsSync("address.json")) {
    addresses = JSON.parse(fs.readFileSync("address.json", "utf8"));
  }

  if (addresses[chainId] === undefined) {
    addresses[chainId] = {};
  }

  if (addresses[chainId]["ClusterSelector"] !== undefined) {
    console.log("Existing deployment:", addresses[chainId]["ClusterSelector"]);
    return;
  }

  let signers = await ethers.getSigners();
  let addrs = await Promise.all(signers.map((a) => a.getAddress()));

  console.log("Signer addrs:", addrs);

  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
  const clusterSelector = await ClusterSelector.deploy(owner);

  console.log("Deployed addr:", clusterSelector.address);

  addresses[chainId]["ClusterSelector"] = clusterSelector.address;

  fs.writeFileSync("address.json", JSON.stringify(addresses, null, 2), "utf8");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
