import {assign, find, filter, isMatch, matches, pluck, reject, take, zip} from 'lodash';
import walk from 'acorn/util/walk';
import walkall from 'walkall';

const isRequireCallee = matches({
  name: 'require',
  type: 'Identifier'
});

const isDefineCallee = matches({
  type: 'CallExpression',
  // calleee: {
  //   name: 'define',
  //   type: 'Identifier'
  // }
});

const isArrayExpr = matches({
  type: 'ArrayExpression'
});

const isFuncExpr = matches({
  type: 'FunctionExpression'
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

function createImportSpecifier(source, isDef) {
  // Add the specifier
  let {name, type, start, end} = source;
  return {
    start, end,
    type: 'ImportSpecifier',
    id: {
      type, start, end, name
    },
    default: typeof isDef === 'boolean' ? isDef : true
  };
}

function createSourceNode(node, source) {
  let {value, raw, start, end} = source;
  return {
    type: 'Literal',
    reference: node,
    value, raw, start, end
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
      if (isMatch(value, { type: 'CallExpression' })) {
        importExpr = value;
      }

      let source = isVariable ? declaration.id : declaration.key;
      result.specifiers.push(createImportSpecifier(source, isVariable));
    }
  }

  result.source = createSourceNode(node, importExpr.arguments[0]);
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
        if (isMatch(value, { type: 'CallExpression' })) {
          expr = value;
        }
    }
    if (expr && isRequireCallee(expr.callee)) {
      requires.push(node);
    }
  }), walkall.traversers);

  // Filter the overlapping requires (e.g. if var x = require('./x') it'll show up twice).
  // Do this by just checking line #'s
  return reject(requires, node => {
      return requires.some(parent =>
        [node.start, node.stop].some(pos => pos > parent.start && pos < parent.end));
    })
    .map(constructCJSImportNode);
}

// Note there can be more than one define per file with global registeration.
function findAMD(ast) {
  return pluck(filter(ast.body, {
    type: 'ExpressionStatement'
  }), 'expression')
  .filter(isDefineCallee)
  // Til https://github.com/lodash/lodash/commit/f20d8f5cc05f98775969c504b081ccc1fddb54c5
  .filter(node => {
    return isMatch(node.callee, {
      name: 'define',
      type: 'Identifier'
    });
  })
  // Ensure the define takes params and has a function
  .filter(node => node.arguments.length <= 3)
  .filter(node => filter(node.arguments, isFuncExpr).length === 1)
  .filter(node => filter(node.arguments, isArrayExpr).length <= 1)
  // Now just zip the array arguments and the provided function params
  .map(node => {
    let outnode = constructImportNode(node, 'AMDImport');


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
  // Now just format them up
  // .map(node => console.log(node));
}

export default function(ast, options) {
  options = assign({
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
    result.push(...filter(ast.body, {
      type: 'ImportDeclaration'
    }));
  }

  if (options.amd) {
    result.push(...findAMD(ast));
  }

  return result;
}