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
const HelloWorld = artifacts.require('HelloWorld');

contract('HelloWorld', (accounts) => {
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
        })

        it('emits a LogMessageChanged event on successful changed message', async () => {
            expectEvent(receipt, 'LogMessageChanged', {
                oldMessage: 'Hello, World !!!',
                newMessage: 'How are you, World?',
                timestamp: new BN(timestamp)
            })
        })
    })
})
