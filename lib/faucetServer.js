const express = require("express");
const bodyParser = require('body-parser');
const validateRequest = require('./helpers/validateRequest');

var app = express();

app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/test', async function(req, res) {
    let validRequestObject = await validateRequest(req);

    if (validRequestObject.success) {
      let body = res.body;
      if(body != null || body != undefined) {
        let toAddress = body.to;
        let amount = body.amount;
        //call the wallet function to transfer eth
        //wallet.transfer
      }
      res.send("ok");
    }
    else {
      res.status(400);
      res.send(validRequestObject.msg);  
    }    
})

var server = app.listen(4000, function() {
    console.log("Listening on port %s...", server.address().port);
});