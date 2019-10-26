const MarlinPaymentChannel = artifacts.require("MarlinPaymentChannel")

contract('MarlinPaymentChannel', () => {
    let marlinPaymentChannel = null;
    let accounts = [];
    let initialBalance = 0;
    before(async () => {
        marlinPaymentChannel = await MarlinPaymentChannel.deployed();
        accounts = await web3.eth.getAccounts();
    })
    it('MarlinPaymentChannel Contract Deployment Successful', async () => {
        //console.log(marlinPaymentChannel.address);
        assert(marlinPaymentChannel != '');
    })

    it('Defined Account in the Constructor should have balance', async () => {
        const bal = await marlinPaymentChannel.getBalance("0xd03ea8624C8C5987235048901fB614fDcA89b117")
        initialBalance = bal.toNumber();
        assert(bal.toNumber() == 500);
    })

    it('Defray Function Should Execute and Disburse Amount Successfully', async () => {
        await marlinPaymentChannel.defray("0xffcf8fdee72ac11b5c542428b35eef5769c409f07bb0a26f16471e1a4f48ca3f31025faaf3665cb56170938e4d6880c3ae3e729931d146d0cd765871b5f880cecbc979e2b38434cf341681c7817cbce3b599af691b22d491bde2303f2f43325b2108d26f1eaba1e32b8dded954157e092528117b774aff92f3913a7afef1c588ab0d42bd495a11e9bd20ce8e61e336662781929a4d4102e9a986e32a3b63b538276100b4917c21bbfa1ce11ba2b4d45eaed5996cd0823791e0c93114882d5621b377df8cd1741c3a86a582cc67939c195270652357ae1e55d50f2925bfb125c18436368c9ad32b69eb6bc6af13e9dbb454bacaf72541e5d6c96f5687462a1c", "0x7d974eac70e63e188ead1e76a8bb0b82b95d08b237a4ece409da144b92ad5c6b63abdc9d0991dc040484ff858df98806ed2904e00253ce3bee314fe2206dc3cb1c", {from: accounts[0]})
    })

    it('Amount Should be Deducted and Added in others Accounts correctly', async () => {
        const senderBalance = await marlinPaymentChannel.getBalance("0xd03ea8624C8C5987235048901fB614fDcA89b117");
        assert(senderBalance.toNumber() == initialBalance - 20);
        const firstPersonBalance = await marlinPaymentChannel.getBalance("0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1");
        assert(firstPersonBalance.toNumber() == 8, "Funds to first not received");
        const secondPersonBalance = await marlinPaymentChannel.getBalance("0xffcf8fdee72ac11b5c542428b35eef5769c409f0");
        assert(secondPersonBalance.toNumber() == 6, "Funds to second not received");
        const thirdPersonBalance = await marlinPaymentChannel.getBalance("0x22d491bde2303f2f43325b2108d26f1eaba1e32b");
        assert(thirdPersonBalance.toNumber() == 4, "Funds to third not received");
        const fourthPersonBalance = await marlinPaymentChannel.getBalance("0xe11ba2b4d45eaed5996cd0823791e0c93114882d");
        assert(fourthPersonBalance.toNumber() == 2, "Funds to fourth not received");
    })

    it('Double Spending Possible --> Attack', async () => {
        await marlinPaymentChannel.defray("0xffcf8fdee72ac11b5c542428b35eef5769c409f07bb0a26f16471e1a4f48ca3f31025faaf3665cb56170938e4d6880c3ae3e729931d146d0cd765871b5f880cecbc979e2b38434cf341681c7817cbce3b599af691b22d491bde2303f2f43325b2108d26f1eaba1e32b8dded954157e092528117b774aff92f3913a7afef1c588ab0d42bd495a11e9bd20ce8e61e336662781929a4d4102e9a986e32a3b63b538276100b4917c21bbfa1ce11ba2b4d45eaed5996cd0823791e0c93114882d5621b377df8cd1741c3a86a582cc67939c195270652357ae1e55d50f2925bfb125c18436368c9ad32b69eb6bc6af13e9dbb454bacaf72541e5d6c96f5687462a1c", "0x7d974eac70e63e188ead1e76a8bb0b82b95d08b237a4ece409da144b92ad5c6b63abdc9d0991dc040484ff858df98806ed2904e00253ce3bee314fe2206dc3cb1c", {from: accounts[0]})
        const senderBalance = await marlinPaymentChannel.getBalance("0xd03ea8624C8C5987235048901fB614fDcA89b117");
        assert(senderBalance.toNumber() == initialBalance - 40);
    })
})