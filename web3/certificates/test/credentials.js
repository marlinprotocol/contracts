const Accounts = require('web3-eth-accounts');

const accounts = new Accounts();

exports.publisherAccount = accounts.privateKeyToAccount('0x942612c8559dd1240f52f1e507c2fa0f1513b2bc2261669c23e7b4db7c914bf0');
exports.clientAccount = accounts.privateKeyToAccount('0x50dae8a62327accf17158fa7f98893a06944cd63fccf99f63185924d7235f857');
exports.winningNodeAccount = accounts.privateKeyToAccount('0x83c99c1c5a91ba472eff609b72a02498d67a71a1dc909ba5236f23d0a27b2c43');
exports.losingNodeAccount = accounts.privateKeyToAccount('0x59f7618730bbdb3e15211586b99ea324ee7d5a03e2b74e3c3a8864987c938820');
