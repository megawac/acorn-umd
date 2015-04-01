import {assign, find, filter, matches, pluck, reject, sortBy, take, zip} from 'lodash';
import estraverse from 'estraverse';
import escope from 'escope';

import Node from './Node';
import ImportNode from './ImportNode';

const isRequireCallee = matches({
  type: 'CallExpression',
  callee: {
    name: 'require',
    type: 'Identifier'
  }
});

const isDefineCallee = matches({
  type: 'CallExpression',
  callee: {
    name: 'define',
    type: 'Identifier'
  }
});

const isArrayExpr = matches({
  type: 'ArrayExpression'
});

function isFuncExpr(node) {
  return /FunctionExpression$/.test(node.type);
}

// Set up an AST Node similar to an ES6 import node
function constructImportNode(astWrap, node, type) {
  let {start, end} = node;
  return new ImportNode(astWrap, node, {
    type,
    specifiers: [],
    start, end
  });
}

function createImportSpecifier(source, isDef) {
  // Add the specifier
  let {name, type, start, end} = source;
  return new Node({
    start, end,
    type: 'ImportSpecifier',
    id: {
      type, start, end, name
    },
    default: typeof isDef === 'boolean' ? isDef : true
  });
}

function createSourceNode(node, source) {
  let {value, raw, start, end} = source;
  return new Node({
    type: 'Literal',
    reference: node,
    value, raw, start, end
  });
}

function constructCJSImportNode(astWrap, node) {
  let result = constructImportNode(astWrap, node, 'CJSImport');
  let importExpr, isVariable = false;

  switch (node.type) {
    case 'CallExpression':
      importExpr = node;
      break;
    case 'AssignmentExpression':
      let specifier = createImportSpecifier(node.left, false);
      specifier.id.name = node.left.property.name;
      result.specifiers.push(specifier);
      importExpr = node.right;
      break;
    case 'VariableDeclaration':
      isVariable = true;
      /* falls through */
    case 'Property': {
      let declaration = isVariable ? node.declarations[0] : node;
      // init for var, value for property
      let value = declaration.init || declaration.value;
      let source = isVariable ? declaration.id : declaration.key;
      importExpr = value;
      result.specifiers.push(createImportSpecifier(source, isVariable));
    }
  }

  result.source = createSourceNode(node, importExpr.arguments[0]);
  return result;
}

function findCJS(astWrap) {
  // Recursively walk ast searching for requires
  let requires = [];
  estraverse.traverse(astWrap.ast, {
    enter(node) {
      let expr;
      switch (node.type) {
        case 'CallExpression':
          expr = node;
          break;
        case 'AssignmentExpression':
          expr = node.right;
          break;
        case 'Property':
        case 'VariableDeclaration':
          let declaration = node.declarations ? node.declarations[0] : node;
          // init for var, value for property
          expr = declaration.init || declaration.value;
      }
      if (expr && isRequireCallee(expr)) {
        requires.push(node);
      }
    }
  });

  // Filter the overlapping requires (e.g. if var x = require('./x') it'll show up twice).
  // Do this by just checking line #'s
  return reject(requires, node => {
      return requires.some(parent =>
        [node.start, node.stop].some(pos => pos > parent.start && pos < parent.end));
    })
    .map(node => constructCJSImportNode(astWrap, node));
}

// Note there can be more than one define per file with global registeration.
function findAMD(astWrap) {
  return pluck(filter(astWrap.ast.body, {
    type: 'ExpressionStatement'
  }), 'expression')
  .filter(isDefineCallee)
  // Ensure the define takes params and has a function
  .filter(node => node.arguments.length <= 3)
  .filter(node => filter(node.arguments, isFuncExpr).length === 1)
  .filter(node => filter(node.arguments, isArrayExpr).length <= 1)
  // Now just zip the array arguments and the provided function params
  .map(node => {
    let outnode = constructImportNode(astWrap, node, 'AMDImport');

    let func = find(node.arguments, isFuncExpr);
    let imports = find(node.arguments, isArrayExpr) || {elements: []};

    let params = take(func.params, imports.elements.length);
    outnode.specifiers = params;

    if (imports) {
      // Use an array even though its not spec as there isn't a better way to
      // represent this structure
      outnode.sources = imports.elements.map(imp => createSourceNode(node, imp));
      // Make nicer repr: [[importSrc, paramName]]
      outnode.imports = zip(imports.elements, params);
    }
    return outnode;
  });
}

export default function(ast, options) {
  options = assign({
    cjs: true,
    // TODO
    amd: false,
    es6: true
  }, options);
  let astWrap = {
    ast,
    scopeManager: escope.analyze(ast)
  };

  let result = [];

  if (options.cjs) {
    result.push(...findCJS(astWrap));
  }

  if (options.es6) {
    result.push(...filter(ast.body, {
      type: 'ImportDeclaration'
    })
    .map(node => new ImportNode(astWrap, node, node)));
  }

  if (options.amd) {
    result.push(...findAMD(astWrap));
  }

  return sortBy(result, 'start');
}