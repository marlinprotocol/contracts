const fs = require("fs");

const MarlinContractJSON = require("../marlin-payments/build/contracts/MarlinPaymentChannel.json");

let contract = {
  contractname: MarlinContractJSON.contractName,
  address:
    MarlinContractJSON.networks[
      Object.keys(MarlinContractJSON.networks)[
        Object.keys(MarlinContractJSON.networks).length - 1
      ]
    ].address,
  abi: MarlinContractJSON.abi
};

fs.writeFileSync(`${contract.contractname}.json`, JSON.stringify(contract));
