const Utils = function base() {};

Utils.prototype.concatUint8Arrays = (...args) => {
  const totalLength = args.reduce((acc, cur) => acc + cur.length, 0);
  const newArray = new Uint8Array(totalLength);
  let offset = 0;
  args.forEach((array) => {
    newArray.set(array, offset);
    offset += array.length;
  });

  return newArray;
};

module.exports = new Utils();
