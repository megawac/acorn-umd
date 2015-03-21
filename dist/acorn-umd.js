var _toConsumableArray = function (arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } };

(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory(require("lodash"), require("acorn/util/walk"), require("walkall")) : typeof define === "function" && define.amd ? define(["lodash", "acorn/util/walk", "walkall"], factory) : global.acornUmd = factory(global.lodash, global.walk, global.walkall);
})(this, function (lodash, walk, walkall) {
  "use strict";

  var isRequireCallee = lodash.matches({
    name: "require",
    type: "Identifier"
  });

  // Set up an AST Node similar to an ES6 import node
  function constructImportNode(node, type) {
    var start = node.start;
    var end = node.end;

    return {
      type: type,
      reference: node,
      specifiers: [],
      start: start, end: end
    };
  }

  function constructCJSImportNode(node) {
    var result = constructImportNode(node, "CJSImport");
    var importExpr = undefined,
        isVariable = false;

    switch (node.type) {
      case "CallExpression":
        importExpr = node;
        break;
      case "VariableDeclaration":
        isVariable = true;
      /* falls through */
      case "Property":
        {
          var declaration = isVariable ? node.declarations[0] : node;
          // init for var, value for property
          var _value = declaration.init || declaration.value;
          if (lodash.isMatch(_value, { type: "CallExpression" })) {
            importExpr = _value;
          }

          var source = isVariable ? declaration.id : declaration.key;

          // Add the specifier
          var _name = source.name;
          var type = source.type;
          var _start = source.start;
          var _end = source.end;

          result.specifiers.push({
            start: _start, end: _end,
            type: "ImportSpecifier",
            id: {
              type: type, start: _start, end: _end, name: _name
            },
            "default": isVariable
          });
        }
    }

    var _importExpr$arguments$0 = importExpr.arguments[0];
    var value = _importExpr$arguments$0.value;
    var raw = _importExpr$arguments$0.raw;
    var start = _importExpr$arguments$0.start;
    var end = _importExpr$arguments$0.end;

    result.source = {
      type: "Literal",
      reference: node,
      value: value, raw: raw, start: start, end: end
    };

    return result;
  }

  function findCJS(ast) {
    // Recursively walk ast searching for requires
    var requires = [];
    walk.simple(ast, walkall.makeVisitors(function (node) {
      var expr = undefined;
      switch (node.type) {
        case "CallExpression":
          expr = node;
          break;
        case "Property":
        case "VariableDeclaration":
          var declaration = node.declarations ? node.declarations[0] : node;
          // init for var, value for property
          var value = declaration.init || declaration.value;
          if (lodash.isMatch(value, { type: "CallExpression" })) {
            expr = value;
          }
      }
      if (expr && isRequireCallee(expr.callee)) {
        requires.push(node);
      }
    }), walkall.traversers);

    return lodash(requires)
    // Filter the overlapping requires (e.g. if var x = require('./x') it'll show up twice).
    // Do this by just checking line #'s
    .reject(function (node) {
      return lodash.any(requires, function (parent) {
        return [node.start, node.stop].some(function (pos) {
          return lodash.inRange(pos, parent.start + 0.1, parent.end);
        });
      });
    }).map(constructCJSImportNode).value();
  }

  var acorn_umd = function acorn_umd(ast, options) {
    options = lodash.extend({
      cjs: true,
      // TODO
      amd: false,
      es6: true
    }, options);

    var result = [];

    if (options.cjs) {
      result.push.apply(result, _toConsumableArray(findCJS(ast)));
    }

    if (options.es6) {
      result.push.apply(result, _toConsumableArray(lodash.filter(ast.body, {
        type: "ImportDeclaration"
      })));
    }

    return result;
  };

  return acorn_umd;
});
//# sourceMappingURL=./acorn-umd.js.map