var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var merge = require("lodash").merge;

var Node = require("acorn").Node;

var ImportNode = (function (_Node) {
  function ImportNode(settings) {
    _classCallCheck(this, ImportNode);

    merge(this, settings);
  }

  _inherits(ImportNode, _Node);

  return ImportNode;
})(Node);

module.exports = ImportNode;