const express = require("express");
const bodyParser = require('body-parser');
const validateRequest = require('./helpers/validateRequest');
const Wallet = require("./wallet");

class Faucet {
  constructor(faucetPrivateKey, providerUrl) {
    this._myWallet = new Wallet();

    this._myWallet.init({
      "privateKey": faucetPrivateKey,
      "providerUrl": providerUrl
    });
  }

  initServer() {
    let app = express();

    app.use(bodyParser.json());

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    app.post('/test', async (req, res) => {

        let validRequestObject = await validateRequest(req);

        if (validRequestObject.success) {
          let body = req.body;
          if(body != null && body != undefined) {
            let toAddress = body.to;
            let amount = body.amount;
            //call the wallet function to transfer eth
            this._myWallet.transferEther(toAddress, amount)
            .then(signedTxn => {
              console.log("signedTxn: " + signedTxn)
              this._myWallet.sendSignedTxnandWaitConfirmation(signedTxn.rawTransaction, 1)
              .then(msg => {
                console.log(msg);
                res.send("ok");
              })
              .catch(err => {
                console.log(err);
                res.status(400);
                res.send(err);
              })
            })
            .catch(err => {
                console.log(err);
                res.status(400);
                res.send(err);
              })
          }
          else {
            res.status(400);
            res.send("Empty body");
          }
        }
        else {
          res.status(400);
          res.send(validRequestObject.msg);
        }
    })

    this._app = app;
    this._server = app.listen(4000, function() {
      console.log("Listening on port %s...",  4000);
    });

  }
}

module.exports = Faucet