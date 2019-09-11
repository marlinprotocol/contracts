# contract.js

Ethereum contract interfaces

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

-   [CertificateContract](#certificatecontract)
    -   [Parameters](#parameters)
    -   [Properties](#properties)
    -   [settleWinningCertificate](#settlewinningcertificate)
        -   [Parameters](#parameters-1)

### CertificateContract

Class wrapping certificate contract.

#### Parameters

-   `Web3Contract` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Web3 Contract class - usually `web3.eth.Contract`
-   `address` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Address of contract, can be set after construction (optional, default `undefined`)

#### Properties

-   `address` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Contract address

#### settleWinningCertificate

Creates a new certificate contract instance.

##### Parameters

-   `offerId`  
-   `winningCertificate`  
-   `Web3Contract` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Web3 Contract class - usually `web3.eth.Contract`
-   `address` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Address of contract, can be set after construction

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Web3 transaction object, ref: <https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id14>
