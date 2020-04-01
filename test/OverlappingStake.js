var OverlappingStake = artifacts.require("./OverlappingStake.sol");

contract("OverlappingStake", function (accounts) {
    var address = "0x0000000000000000000000000000000000000000";
    var messageId = "0x11111111";
    var channelId = "0x2222";
    var timestamp = 0x33333333;
    var messageSize = 0x44444444;
    var stakeOffset = 0x55555555;
    var chunkHash = "0x6666666666666666666666666666666666666666666666666666666666666666";
    var sigVersion = 0x77;
    var sigRS = '0x88888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888';
    
    var attestationBytes = '0x11111111222233333333444444445555555566666666666666666666666666666666666666666666666666666666666666667788888888888888888888888888888888888888888888888888888888888888889999999999999999999999999999999999999999999999999999999999999999';

    var contractInstance;
    it("check attestation overlapping function", function () {
        return OverlappingStake.deployed().then(function (instance) {
            contractInstance = instance;
            return instance.reportOverlappingProducerStakes(attestationBytes, attestationBytes).then(function(result){
                return result;
            });
        }).then(function(result){
            console.log("*************");
            console.log(result);
            console.log("*************");
            return result;
        }).then(function(data){
            return contractInstance.reportOverlappingProducerStakes.call(attestationBytes, attestationBytes).then(function(result){
                return result;
            });
        }).then(function(result){
            assert.equal(result, true, "Overlapping Attestation");
        })
    })
})