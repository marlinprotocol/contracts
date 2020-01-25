const rp = require('request-promise');
const crypto = require('crypto');
const eth_crypto = require('./helpers/eth-crypto.js');
const ethUtil = require('ethereumjs-util');

function getRequestHeader(msgJson, pubKey, privateKey) {
    var nonceBuf = eth_crypto.generateNonceBuffer();
    var nonceHex = ethUtil.bufferToHex(nonceBuf);

    var timeStampMsecs = Date.now();
    var timeStampBuf = ethUtil.toBuffer(timeStampMsecs);

    console.log("nonce");
    console.log(nonceBuf);
    console.log(nonceHex);

    var saltedMsgBuf = eth_crypto.createSaltedMsgBuf(msgJson, nonceBuf, timeStampBuf);
    var saltedMsgHex = ethUtil.bufferToHex(saltedMsgBuf);

    console.log(saltedMsgBuf);

    var signedMsgBuf = eth_crypto.sign(saltedMsgBuf, privateKey);
    console.log(signedMsgBuf);
    var signedMsgHex = ethUtil.bufferToHex(signedMsgBuf);
    console.log("signedMsg");
    console.log(signedMsgBuf);
    console.log(signedMsgHex);

    return {
        "timestamp": timeStampMsecs,
        "nonce": nonceHex,
        "signature": signedMsgHex,
        "pubkey": pubKey
    }
}

function getEthRequestMsgJson(pubKey, valueInWei) {
    msgJson = {
        "to": pubKey,
        "value": valueInWei
    }

    return msgJson
}



function requestEth(pubKey, privateKey, valueInWei) {
    var msgJson = getEthRequestMsgJson(pubKey, valueInWei)
    var requestHeader = getRequestHeader(msgJson, pubKey, privateKey);

    let url = "http://localhost:4000/test";

    request_options = {
        uri: url,
        method: "POST",
        headers: requestHeader,
        json: true, // Very important parameter
        body: msgJson
    }

    return rp(request_options)
}

module.exports = {
    requestEth
}


