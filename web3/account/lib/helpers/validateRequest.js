const eth_crypto = require('./eth-crypto.js');
const redis_storage = require('./redis-storage');
const ethUtil = require('ethereumjs-util');

const reqExpiryMsecs = 10000;// dont accept packets later than this
const nonceExpirySecs = 10;// dont accept packets later than this

module.exports = async function (req) {

	let nonceHex = req.headers['nonce'];
    let signedMsgHex = req.headers['signature'];
    let pubKeyHex = req.headers['pubkey'];
    if (nonceHex == undefined || signedMsgHex == undefined || pubKeyHex  == undefined || req.headers['timestamp'] == undefined) {
    	return {
    		'success': false,
    		'msg': 'missing headers'
      	}
    }

	let timeStampMsecs = parseInt(req.headers['timestamp']);
    if (timeStampMsecs == undefined || Date.now() - timeStampMsecs > reqExpiryMsecs) {
      return {
      	'success': false,
      	'msg': 'timestamp expired'
      }
    }

    let msgJson = req.body;
    if (msgJson == undefined) {
    	return {
    		'success': false,
    		'msg': 'missing body'
      	}
    }

    try {
	  	let isKeyPresent = await redis_storage.isPresent(pubKeyHex, nonceHex);
	  	if (isKeyPresent)
	  		return {
    			'success': false,
    			'msg': 'same nonce used to soon'
      		}
	  	else
	  		redis_storage.addNonce(pubKeyHex, nonceHex, nonceExpirySecs)
    } catch(err) {
		return {
    			'success': false,
    			'msg': err
      	}
    	console.log(err);
  	}

    var saltedMsgBuf = eth_crypto.createSaltedMsgBuf(msgJson, ethUtil.toBuffer(nonceHex), ethUtil.toBuffer(timeStampMsecs));
    var verification = eth_crypto.verify(saltedMsgBuf, signedMsgHex, ethUtil.toBuffer(pubKeyHex));
    
  	if (verification) {
  		return {
    		'success': true,
    		'msg': 'success!'
      	}
  	} else {
  		return {
    		'success': false,
    		'msg': 'incorrect signature'
      	}
  	}
}