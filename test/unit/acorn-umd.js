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

    describe('identifies property cases', function() {
        let code = `
            var f = {
                a: 1, b: 2,
                foo: require('bar')
            }

            f.x = require('foo');
        `;

        let ast = acorn.parse(code);
        let imports = umd(ast, {
            es6: false, amd: false, cjs: true
        });

        it('identifies all cases', function() {
            expect(imports).to.have.length(2);
            expect(_.all(imports, {
                type: 'CJSImport'
            })).to.be.ok;
            expect(_.all(imports, 'source')).to.be.ok;
            expect(_.all(imports, 'specifiers')).to.be.ok;
            expect(_.all(imports, 'reference')).to.be.ok;
        });

        it('object declaration property style', function() {
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

        it('additional property style', function() {
            let test = imports[1];
            // console.log(test);
            expect(test.specifiers[0]).to.be.deep.equal({
                type: 'ImportSpecifier',
                start: 114,
                end: 117,
                id: { type: 'MemberExpression', start: 114, end: 117, name: 'x' },
                default: false
            });

            expect(_.omit(test.source, 'reference')).to.be.deep.equal({
                type: 'Literal',
                value: 'foo',
                raw: '\'foo\'',
                start: 128,
                end: 133
            });
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

        export default function a() {}
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

describe('Parsing AMD define import nodes', function() {
    describe('common case', function() {
        let code = `
            foo();
            define(['foo', 'bar', 'twat', 'unused-import'], function(foo, bar, $) {
                return foo();
            });
        `;

        let ast = acorn.parse(code, {ecmaVersion: 6});
        let parsed = umd(ast, {
            es6: false, amd: true, cjs: false
        });

        it('AMD identifies multiple variables', function() {
            expect(parsed).to.have.length(1);
        });

        it('has the correct specifiers,imports&sources', function() {
            let {specifiers, imports, sources} = parsed[0];
            expect(imports).to.have.length(4);
            expect(sources).to.have.length(4);
            expect(specifiers).to.have.length(3);
        });

        it('sources are zipped correctly', function() {
            [['foo', 'foo'], ['bar', 'bar'], ['twat', '$'], ['unused-import']].forEach((pair, i) => {
                let cpair = parsed[0].imports[i];
                expect(cpair[0]).to.have.property('value', pair[0]);
                expect(cpair[0]).to.have.property('raw', `'${pair[0]}'`);
                if (pair.length > 1) {
                    expect(cpair[1]).to.have.property('name', pair[1]);
                } else {
                    expect(cpair[1]).to.be.undefined;
                }
            });
        });

    });

    describe('AMD works with global declaration with imports', function() {
        let code = `
            define(['smt'], 'global', function(smt) {return null;});
        `;
        let ast = acorn.parse(code, {ecmaVersion: 6});
        let parsed = umd(ast, {
            es6: false, amd: true, cjs: false
        });

        it('has the correct length', function() {
            expect(parsed).to.have.length(1);
        });

        it('has the correct specifiers,imports&sources', function() {
            let {specifiers, imports, sources} = parsed[0];
            expect(imports).to.have.length(1);
            expect(sources).to.have.length(1);
            expect(specifiers).to.have.length(1);
        });
    });

    describe('AMD identifies no variables', function() {
        let code = `
            define(function() {return null;});
        `;
        let ast = acorn.parse(code, {ecmaVersion: 6});
        let parsed = umd(ast, {
            es6: false, amd: true, cjs: false
        });

        it('has the correct length', function() {
            expect(parsed).to.be.length(1);
        });

        it('has the correct specifiers,imports&sources', function() {
            let {specifiers, imports, sources} = parsed[0];
            expect(imports).to.be.empty;
            expect(sources).to.be.empty;
            expect(specifiers).to.be.empty;
        });
    });

    describe('AMD identifies with gllobal declaration & no variables', function() {
        let code = `
            define('global', function() {return null;});
        `;
        let ast = acorn.parse(code, {ecmaVersion: 6});
        let parsed = umd(ast, {
            es6: false, amd: true, cjs: false
        });

        it('has the correct length', function() {
            expect(parsed).to.be.length(1);
        });

        it('has the correct specifiers,imports&sources', function() {
            let {specifiers, imports, sources} = parsed[0];
            expect(imports).to.be.empty;
            expect(sources).to.be.empty;
            expect(specifiers).to.be.empty;
        });
    });

    describe('with multiple declarations in a file', function() {
        let code = `
            define('foo', function() {return 5});
            define(['foo', 'x'], 'bar', function(foo, x) {
                return x + foo;
            });
            define(['bar', 'unused-import'], function(bar) {
                return Math.pow(bar, 2);
            });
        `;
        let ast = acorn.parse(code, {ecmaVersion: 6});
        let parsed = umd(ast, {
            es6: false, amd: true, cjs: false
        });

        it('finds all defines with imports', function() {
            expect(parsed).to.have.length(3);
        });

        it('Global no vars parsed correctly', function() {
            let {specifiers, imports, sources} = parsed[0];
            expect(imports).to.be.empty;
            expect(sources).to.be.empty;
            expect(specifiers).to.be.empty;
        });

        it('Global with imports parsed correctly', function() {
            let {specifiers, imports, sources} = parsed[1];
            expect(imports).to.have.length(2);
            expect(sources).to.have.length(2);
            expect(specifiers).to.have.length(2);
        });

        it('Anon with imports parsed correctly', function() {
            let {specifiers, imports, sources} = parsed[2];
            expect(imports).to.have.length(2);
            expect(sources).to.have.length(2);
            expect(specifiers).to.have.length(1);
        });
    });
});
