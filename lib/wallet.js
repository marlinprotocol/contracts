const Web3 = require('web3');

class Wallet {
	constructor() {
        this.owner = undefined;
        this.privateKey = null;
        this.providerUrl = null;
        this.contracts = null;
        this.instances = null;
        this.logger = null;
        this.web3 = null;
	}

	async init(options) {
        this.providerUrl = options.providerUrl;
        this.web3 = new Web3(this.providerUrl);
        this.privateKey = options.privateKey;
        this.account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
        this.owner = this.account.address;

        // console.log(this.web3);
        // console.log(this.account);
    }

    /**
     * Unitialize the sdk and release all resources
     */
    uninit() {
        if (typeof this.provider.stop === 'function') {
            this.provider.stop();
        }
        this.provider = undefined;
        this.owner = undefined;
        this.ownerPrivateKey = undefined;
        this.contracts = undefined;
        this.web3 = undefined;
        this.instances = undefined;
        this.logger = undefined;
    }

    /**
     * [async] Get ethereum coin balance of anyone
     *
     * @return Number with unit in ether
     */
    async getEtherBalance(address) {
        const web3 = this.web3;
        let weiBalance = await this.getEtherBalanceinWei(address);
        return web3.utils.fromWei(weiBalance, 'ether');
    }

    /**
     * [async] Get ethereum coin balance of anyone
     *
     * @return Number with unit in Wei
     */
    async getEtherBalanceinWei(address) {
    	const web3 = this.web3;
        return web3.eth.getBalance(address);
    }

    /**
     * [async] Transfer ethereum coin from owner to others
     *
     * @param to - transfer ether to this account
     * @param value - amount of ethereum coin to be transferred, in unit of ether
     */

    async transferEther(to, value) {
        const web3 = this.web3;
        const owner = this.owner;

        var tx = {
            from: this.owner,
            to: to,
            gas: 2000000,
            value: value
        };

        var signedTxn = await this.signTransaction(tx, this.privateKey);
        console.log(signedTxn);
        
        this.sendSignedTransaction(signedTxn.rawTransaction)
    }

    async signTransaction(tx, privateKey) {
        return this.web3.eth.accounts.signTransaction(tx, this.privateKey);
    }

    async sendSignedTransaction(rawTxn) {
        var tran = this.web3.eth.sendSignedTransaction(rawTxn);

        tran.on('confirmation', (confirmationNumber, receipt) => {
          console.log('confirmation: ' + confirmationNumber);
        });

        tran.on('transactionHash', hash => {
          console.log('hash');
          console.log(hash);
        });

        tran.on('receipt', receipt => {
          console.log('reciept');
          console.log(receipt);
        });

        tran.on('error', console.error);
    }

    // getTransactionReceiptMined(web3, txnHash, interval, waitForNrConfirmations) {
    //     interval = interval ? interval : 500;
    //     let transactionReceiptAsync = function(txnHash, resolve, reject) {
    //         try {
    //             web3.eth.getTransactionReceipt(txnHash, function (err, receipt) {
    //                 if (err) {
    //                     reject(err);
    //                     return;
    //                 }
    //                 // FIXME check if recipt shows tx rejected/failed
    //                 if (!receipt || !receipt.blockNumber) {
    //                     setTimeout(function () {
    //                         transactionReceiptAsync(txnHash, resolve, reject);
    //                     }, interval);
    //                 } else {
    //                     // check the block number returned is mined into 10 blocks afterwards
    //                     if (waitForNrConfirmations && waitForNrConfirmations > 0) {
    //                         waitForConfirmations(resolve, reject, web3, txnHash, receipt, waitForNrConfirmations);
    //                     } else {
    //                         resolve(receipt);
    //                     }
    //                 }
    //             });
    //         } catch(e) {
    //             reject(e);
    //         }
    //     };

    //     return new Promise(function (resolve, reject) {
    //         transactionReceiptAsync(txnHash, resolve, reject);
    //     });
    // }

    //  /**
    //  * [async] Get Noia token balance of anyone
    //  *
    //  * @return Number with floating point
    //  */
    // async getLinBalance(address) {
    //     return (await this.instances.tokenContract.balanceOf.call(address)).toNumber();
    // }

    // /**
    //  * [async] Transfer noia token from owner to others
    //  *
    //  * @param to - transfer ether to this account
    //  * @param value - amount of noia token to be transferred
    //  */
    // async transferNoiaToken(to, value) {
    //     return await sendTransactionAndWaitForReceiptMined(this.web3, this.instances.tokenContract.transfer,
    //         { from : this.owner },
    //         to, value);
    // }

}

module.exports = Wallet;