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

}

module.exports = Wallet;