const Utils = function base() {};

Utils.prototype.arrToHexString = (arr) => {
  let hexStr = '';
  for (let i = 0; i < arr.length; i += 1) {
    let hex = arr[i].toString(16);
    hex = (hex.length === 1) ? `0${hex}` : hex;
    hexStr += hex;
  }
  return hexStr.toLowerCase();
};

Utils.prototype.hexStringToArr = (hex) => {
  const arr = [];
  for (let i = 0; i < hex.length; i += 2) {
    arr.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(arr);
};

module.exports = new Utils();
