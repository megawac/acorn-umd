import lodash from 'lodash';
import walk from 'acorn/util/walk';
import walkall from 'walkall';

const isRequireCallee = lodash.matches({
  name: 'require',
  type: 'Identifier'
});

// Set up an AST Node similar to an ES6 import node
function constructImportNode(node, type) {
  let {start, end} = node;
  return {
    type: type,
    reference: node,
    specifiers: [],
    start, end
  };
}

function constructCJSImportNode(node) {
  let result = constructImportNode(node, 'CJSImport');
  let importExpr, isVariable = false;

  switch (node.type) {
    case 'CallExpression':
      importExpr = node;
      break;
    case 'VariableDeclaration':
      isVariable = true;
      /* falls through */
    case 'Property': {
      let declaration = isVariable ? node.declarations[0] : node;
      // init for var, value for property
      let value = declaration.init || declaration.value;
      if (lodash.isMatch(value, { type: 'CallExpression' })) {
        importExpr = value;
      }

      let source = isVariable ? declaration.id : declaration.key;

      // Add the specifier
      let {name, type, start, end} = source;
      result.specifiers.push({
        start, end,
        type: 'ImportSpecifier',
        id: {
          type, start, end, name
        },
        default: isVariable
      });
    }
  }

  let {value, raw, start, end} = importExpr.arguments[0];
  result.source = {
    type: 'Literal',
    reference: node,
    value, raw, start, end
  };

  return result;
}

function findCJS(ast) {
  // Recursively walk ast searching for requires
  let requires = [];
  walk.simple(ast, walkall.makeVisitors(function(node) {
    let expr;
    switch (node.type) {
      case 'CallExpression':
        expr = node;
        break;
      case 'Property':
      case 'VariableDeclaration':
        let declaration = node.declarations ? node.declarations[0] : node;
        // init for var, value for property
        let value = declaration.init || declaration.value;
        if (lodash.isMatch(value, { type: 'CallExpression' })) {
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
    .reject(node => {
      return lodash.any(requires, parent =>
        [node.start, node.stop].some(pos => lodash.inRange(pos, parent.start + 0.1, parent.end)));
    })
    .map(constructCJSImportNode)
    .value();
}

export default function(ast, options) {
  options = lodash.extend({
    cjs: true,
    // TODO
    amd: false,
    es6: true
  }, options);


  let result = [];

  if (options.cjs) {
    result.push(...findCJS(ast));
  }

  if (options.es6) {
    result.push(...lodash.filter(ast.body, {
      type: 'ImportDeclaration'
    }));
  }

  return result;
}