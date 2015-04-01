import Node from './Node';

export default class ImportNode extends Node {
  constructor(ast, reference, settings) {
    super(settings);
    this.reference = reference;
    this._ast = ast;
  }

  get scope() {
    console.log(this.reference);
    return this._ast.scopeManager.acquire(this.reference);
  }
}
