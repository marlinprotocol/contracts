const { accounts, contract } = require('@openzeppelin/test-environment');
const {
    BN,
    balance,
    constants,
    ether,
    expectEvent,
    send,
    expectRevert,
    time,
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const HelloWorld = contract.fromArtifact('HelloWorld');

describe('HelloWorld', () => {
    const [coinbase] = accounts;
    let contractInstance;
    before(async () => {
        contractInstance = await HelloWorld.new({ from: coinbase });
    })

    context('changeMessage', () => {
        let receipt;
        const timestamp = Date.now();
        it('should change message to How are you, World?', async () => {
            receipt = await contractInstance.changeMessage('How are you, World?', timestamp, { from: coinbase })
            console.log('Transaction receipt: ', receipt);

        })

        it('emits a LogMessageChanged event on successful changed message', async () => {
            expectEvent(receipt, 'LogMessageChanged', {
                oldMessage: 'Hello, World !!!',
                newMessage: 'How are you, World?',
                timestamp: timestamp
            })
        })
    })
})
