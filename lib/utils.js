var Utils = function () {};

Utils.prototype.concatUint8Arrays = function () {
  var totalLength = arguments.reduce((acc, cur) => acc + cur.length, 0);
  var newArray = new Uint8Array(totalLength);
  var offset = 0;
  for(var argument in arguments) {
    newArray.set(argument, offset);
    offset += argument.length;
  }

  return newArray;
}

module.exports = new Utils();
