import acorn from 'acorn';
import umd from '../../src/acorn-umd';
import _ from 'lodash';

describe('Parsing AST for CommonJS imports', function() {
    
    describe('var|let|const cases', function() {
        let code = `
        var noise;
        var x = require('foo')
        var x1 = require('bar');
        let noisey;
        let y = require('foo')
        let y1 = require('bar');
        const noisez = 1;
        const z = require('foo')
        const z1 = require('bar');
        `;

        let ast = acorn.parse(code, {ecmaVersion: 6});
        let imports = umd(ast, {
            es6: false, amd: false, cjs: true
        });

        it('identifies the right nodes', function() {
            expect(imports).to.have.length(6);
            _(imports).chunk(2)
            .each(_.spread((a, b) => {
                expect(a.end - a.start).to.be.equal(b.end - b.start - 2);
            })).value();
        });

        it('nodes have correct settings', function() {
            expect(_.all(imports, {
                type: 'CJSImport'
            })).to.be.ok;
            expect(_.all(imports, 'source')).to.be.ok;
            expect(_.all(imports, 'specifiers')).to.be.ok;
            expect(_.all(imports, 'reference')).to.be.ok;
        });

        it('`var` node is correct', function() {
            let test = imports[0];

            expect(test.specifiers[0]).to.be.deep.equal({
                type: 'ImportSpecifier',
                start: 32,
                end: 33,
                id: { type: 'Identifier', start: 32, end: 33, name: 'x' },
                default: true
            });

            expect(_.omit(test.source, 'reference')).to.be.deep.equal({
                type: 'Literal',
                value: 'foo',
                raw: '\'foo\'',
                start: 44,
                end: 49
            });
        });

        it('`let` node is correct', function() {
            let test = imports[3];

            expect(test.specifiers[0]).to.be.deep.equal({
                type: 'ImportSpecifier',
                start: 147,
                end: 149,
                id: { type: 'Identifier', start: 147, end: 149, name: 'y1' },
                default: true
            });

            expect(_.omit(test.source, 'reference')).to.be.deep.equal({
                type: 'Literal',
                value: 'bar',
                raw: '\'bar\'',
                start: 160,
                end: 165
            });
        });

        it('`const` node is correct', function() {
            let test = imports[5];

            expect(test.specifiers[0]).to.be.deep.equal({
                type: 'ImportSpecifier',
                start: 241,
                end: 243,
                id: { type: 'Identifier', start: 241, end: 243, name: 'z1' },
                default: true
            });

            expect(_.omit(test.source, 'reference')).to.be.deep.equal({
                type: 'Literal',
                value: 'bar',
                raw: '\'bar\'',
                start: 254,
                end: 259
            });
        });
    });

    it ('should identify property cases', function() {
        let code = `
            var f = {
                a: 1, b: 2,
                foo: require('bar')
            }
        `;

        let ast = acorn.parse(code);
        let imports = umd(ast, {
            es6: false, amd: false, cjs: true
        });

        expect(imports).to.have.length(1);
        expect(_.all(imports, {
            type: 'CJSImport'
        })).to.be.ok;
        expect(_.all(imports, 'source')).to.be.ok;
        expect(_.all(imports, 'specifiers')).to.be.ok;
        expect(_.all(imports, 'reference')).to.be.ok;

        let test = imports[0];

        expect(test.specifiers[0]).to.be.deep.equal({
            type: 'ImportSpecifier',
            start: 67,
            end: 70,
            id: { type: 'Identifier', start: 67, end: 70, name: 'foo' },
            default: false
        });

        expect(_.omit(test.source, 'reference')).to.be.deep.equal({
            type: 'Literal',
            value: 'bar',
            raw: '\'bar\'',
            start: 80,
            end: 85
        });
    });

    it ('should identify direct require calls', function() {
        let code = `
            require('mocha');
            require('smt')
            var x = 1;
        `;

        let ast = acorn.parse(code);
        let imports = umd(ast, {
            es6: false, amd: false, cjs: true
        });

        expect(imports).to.have.length(2);
        expect(_.all(imports, {
            type: 'CJSImport'
        })).to.be.ok;
        expect(_.all(imports, 'source')).to.be.ok;
        expect(_.all(imports, 'specifiers')).to.be.ok;
        expect(_.all(imports, 'reference')).to.be.ok;

        let test = imports[0];
        expect(test.specifiers).to.be.empty;

        expect(_.omit(test.source, 'reference')).to.be.deep.equal({
            type: 'Literal',
            value: 'mocha',
            raw: '\'mocha\'',
            start: 21,
            end: 28
        });
    });
});

describe('Parsing ES6 import nodes', function() {
    let code = `
        import {a, b, c as d} from 'library';
        import foo from 'library';

        function a() {

        }
    `;

    let ast = acorn.parse(code, {ecmaVersion: 6});
    let imports = umd(ast, {
        es6: true, amd: false, cjs: false
    });

    it('should find ES6 import nodes in the AST', function() {
        expect(imports).to.have.length(2);
        expect(_.all(imports, {
            type: 'ImportDeclaration'
        })).to.be.ok;
        expect(_.all(imports, 'source')).to.be.ok;
        expect(_.all(imports, 'specifiers')).to.be.ok;
    });
});

describe('acorn-umd', function() {
  it('should exist', function() {
    expect(acornUmd).to.exist();
  });
});

