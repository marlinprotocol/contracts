var redis = require('redis');
var client = redis.createClient(6379, 'localhost');

function createId(id, nonce) {
  return id + ':' + nonce;
}

function isPresent(id, nonce) {
  const idToBeAdded = createId(id, nonce);

  return new Promise((resolve, reject) => {
    client.get(idToBeAdded, function (error, result) {
      if (error) {
        reject(error);
      }
      if(result == null) {
        resolve(false);
      }
      else {
        resolve(true);
      }
    });
  })
}

function addNonce(id, nonce, timeout) {
  const idToBeAdded = createId(id, nonce);
  client.set(idToBeAdded, nonce, function(err){
    if(err){
      console.log(err);
    }
    else {
      client.expire(idToBeAdded, timeout)
    }
  });
}

module.exports = {
	isPresent,
	addNonce
}