import {parse} from 'acorn';
import umd from '../../src/acorn-umd';
import _ from 'lodash';

describe('Parsing mixed import nodes', function() {
    let code = `
        import {a, b, c as d} from 'library';
        define(['a', 'b'], (e, f) => {
            let x = require('d');
        });
        export default function foo() {}
    `;

    let ast = parse(code, {ecmaVersion: 6, sourceType: 'module'});
    let imports = umd(ast, {
        es6: true, amd: true, cjs: true
    });

    it('should identify all the nodes', function() {
        expect(imports).to.have.length(3);
        expect(_.all(imports, 'source')).to.be.ok;
        expect(_.all(imports, 'specifiers')).to.be.ok;
    });
});
