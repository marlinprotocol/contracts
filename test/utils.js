var Utils = function () {};

Utils.prototype.arrToHexString = function (arr) {
  var hexStr = '';
  for (var i = 0; i < arr.length; i++) {
    var hex = arr[i].toString(16);
    hex = (hex.length === 1) ? '0' + hex : hex;
    hexStr += hex;
  }
  return hexStr.toLowerCase();
}

Utils.prototype.hexStringToArr = function (hex) {
  var arr = [];
  for (var i = 0; i < hex.length; i+=2) {
    arr.push(parseInt(hex.substr(i,2),16));
  }
  return new Uint8Array(arr);
}

module.exports = new Utils();
