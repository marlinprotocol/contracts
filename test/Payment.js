var Payment = artifacts.require("./Payment.sol");

contract("Payment", function (accounts) {
    var paymentInstance;

    it("initializes contract it correct token address", function () {
        return Payment.deployed().then(function (instance) {
            paymentInstance = instance;
            return paymentInstance.address;
        }).then(function (address) {
            assert.notEqual(address, 0x0, "Incorrect address");
            return paymentInstance.token();
        }).then(function (token) {
            assert.notEqual(token, 0x0, "wrong address");
        });
    });

}); 