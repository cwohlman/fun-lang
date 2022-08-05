export class Parser {
  constructor(
    public input: string,
    public index: number = 0,
    public context: Context = new Context()
  ) {}

  peek() {
    return this.input[this.index];
  }

  consume() {
    if (this.index >= this.input.length) this.error("Did not stop");
    this.index++;
  }

  remainder() {
    return this.input.slice(this.index);
  }

  error(message: string) {
    throw new Error(message + " - " + this.remainder());
  }

  consumeWhitespace() {
    while (/\s/.test(this.peek())) {
      this.consume();
    }
  }

  // [statement; statement; statement;] expression
  parseProgram(): ProgramExpression {
    const statements: Statement[] = [];
    let expression: Expression | null = null;
    while (true) {
      this.consumeWhitespace();

      const parsed = this.parseExpression();
      if (!parsed) break;

      this.consumeWhitespace();

      const terminator = this.peek();
      if (terminator == ";") {
        this.checkStatement(parsed);
        statements.push(parsed);
        this.consume();
      } else {
        expression = parsed;
        break;
      }
    }

    if (!expression) {
      this.error("Expected expression in program.");
    }

    return new ProgramExpression(statements, expression, this.context);
  }

  checkStatement(expression: Expression): asserts expression is Statement {
    if (expression instanceof AssertExpression) return;
    if (expression instanceof AssignExpression) return;

    this.error("Expected statement");
  }

  // { block }
  // name
  // name(arguments)
  // parameter>expression
  // name `template string`
  parseExpression(): Expression | null {
    this.consumeWhitespace();

    const firstChar = this.peek();
    if (firstChar == "{") {
      this.consume();
      return this.parseBlock();
    }

    if (firstChar == '"') {
      this.consume();
      return this.parseLiteral();
    }

    const name = this.parseName();
    this.consumeWhitespace();

    if (!name) return null;

    return this.parseExpressionWithName(name);
  }

  requireExpression(): Expression {
    const expression = this.parseExpression();

    if (!expression) this.error("Expression expected");

    return expression;
  }

  parseExpressionWithName(name: string): Expression {
    const follower = this.peek();
    if (follower == "(") {
      this.consume();
      const result = this.parseCall(name);

      return this.maybeParseCall(result);
    }
    if (follower == ">") {
      this.consume();
      return this.parseLambda(name);
    }
    if (follower == "=") {
      this.consume();
      this.consumeWhitespace();

      return this.context.addName(
        name,
        new AssignExpression(name, this.requireExpression(), this.context)
      );
    }
    if (follower == "!") {
      this.consume();
      this.consumeWhitespace();

      return this.context.addName(
        name,
        new AssertExpression(name, this.requireExpression(), this.context)
      );
    }
    if (follower == "`") {
      this.consume();
      
      return this.parseTemplate(name);
    }

    return new NameExpression(name, this.context);
  }

  maybeParseCall(left: Expression): Expression {
    this.consumeWhitespace();
    const next = this.peek();
    if (next == "(") {
      this.consume();
      return this.parseOuterCall(left);
    }

    return left;
  }

  parseOuterCall(left: Expression): Expression {
    const args = this.parseArguments();
    this.consumeWhitespace();

    const closer = this.peek();
    if (closer != ")") {
      this.error("Expected closing paren");
    }
    this.consume();

    return new CallExpression(left, args, this.context);
  }

  parseCall(callee: string): Expression {
    const args = this.parseArguments();
    this.consumeWhitespace();

    const closer = this.peek();
    if (closer != ")") {
      this.error("Expected closing paren");
    }
    this.consume();

    if (callee == "cond") {
      return new ConditionalExpression(args, this.context);
    }

    if (callee == "loop") {
      return new LoopExpression(args, this.context);
    }

    return new CallExpression(new NameExpression(callee, this.context), args, this.context);
  }

  parseBlock(): Expression {
    this.consumeWhitespace();
    this.context = new Context(this.context);

    const result = this.parseProgram();
    this.consumeWhitespace();

    const closer = this.peek();
    if (closer != "}") this.error("Expected closing }");
    this.consume();

    this.context = this.context.parent!;

    return new BlockExpression(result.statements, result.expression, this.context);
  }

  // expression, expression, expression[,]
  parseArguments(): Expression[] {
    const results: Expression[] = [];
    while (true) {
      const arg = this.parseExpression();
      if (!arg) break;

      results.push(arg);
      this.consumeWhitespace();

      if (this.peek() != ",") break;
      this.consume();
    }

    return results;
  }

  // param>expression
  parseLambda(name: string): Expression {
    this.context = new Context(this.context);
    this.context.addName(name, new ParamExpression(name, this.context));

    const expression = this.parseExpression();
    if (!expression)
      this.error("Expected expression on left hand side of lambda");

    this.context = this.context.parent!;

    return new LambdaExpression(name, expression, this.context);
  }

  parseName(): string {
    this.consumeWhitespace();

    let name = "";
    let next = this.peek();

    while (/[a-z0-9_@]/i.test(next)) {
      this.consume();

      name += next;

      next = this.peek();
    }

    return name;
  }

  parseLiteral(): LiteralExpression {
    let value = "";

    // TODO: support multiple quote types for literals
    // TODO: support tagged template literals

    while (true) {
      const next = this.peek();
      this.consume();

      if (! next) {
        throw new Error("Unterminated string");
      }
      if (next == '"') {
        return new LiteralExpression(value, this.context);
      }
      if (next == "\\") {
        const escaped = this.peek();
        if (! escaped) throw new Error("trailing escape sequence")
        
        value += JSON.parse("\"\\" + escaped + "\"");
        
        this.consume();
        continue;
      }

      value += next;
    }
  }
}

export class Context {
  constructor(public parent?: Context) {}

  public readonly names: Map<string, Expression> = new Map();

  copy() {
    const copy = new Context();

    // @ts-ignore
    copy.names = new Map(this.names);

    return copy;
  }

  getLocalName(name: string): Expression {
    const existingName = this.names.get(name);

    if (existingName) return existingName;
    else this.names.set(name, new NameExpression(name, this));

    return this.names.get(name) as Expression; // We know it's not undefined here because we set it above
  }

  getName(name: string): Expression {
    const existingName = this.peekName(name);

    if (existingName) return existingName;
    else this.names.set(name, new NameExpression(name, this));

    return this.names.get(name) as Expression; // We know it's not undefined here because we set it above
  }

  peekName(name: string): Expression | null {
    if (this.names.has(name)) {
      return this.names.get(name) as Expression;
    }

    if (this.parent) return this.parent.peekName(name);

    return null;
  }

  addName(name: string, expression: Expression) {
    if (this.names.has(name)) {
      throw new Error("Name already exists locally");
    }

    this.names.set(name, expression);

    return expression;
  }
}

export class Expression {
  constructor(public scope: Context) {}

  compile(): string {
    throw new Error("Not implemented: " + this.constructor.name);
  }
}

export class UnsafeExpression extends Expression {
  constructor(public rawJS: string, scope: Context) {
    super(scope);
  }

  compile(): string {
    return this.rawJS;
  }
}

export class NameExpression extends Expression {
  constructor(public name: string, scope: Context) {
    super(scope);
  }

  compile(): string {
    // numbers
    if (/(\d+_)*\d+(\.\d+)?/.test(this.name)) return this.name;

    // unrecognized names
    if (!this.scope.peekName(this.name))
      throw new Error("Unrecognized name: " + this.name);

    // recognized names
    return this.name;
  }
}

export class LiteralExpression extends Expression {
  constructor(public value: string, scope: Context) {
    super(scope);
  }

  compile(): string {
    return JSON.stringify(this.value);
  }
}

export class ParamExpression extends Expression {
  constructor(public name: string, scope: Context) {
    super(scope);
  }
  compile(): string {
    return this.name;
  }
}

export class CallExpression extends Expression {
  constructor(public calee: Expression, public args: Expression[], scope: Context) {
    super(scope);
  }

  compile(): string {
    return `${this.calee.compile()}(${this.args.map((arg) => arg.compile()).join(", ")})`;
  }
}
export class ConditionalExpression extends Expression {
  constructor(public args: Expression[], scope: Context) {
    super(scope);

    if (args.length != 3) throw new Error("Invalid number of args");
  }

  compile(): string {
    return `${this.args[0].compile()} ? ${this.args[1].compile()} : ${this.args[2].compile()}`;
  }
}
export class LoopExpression extends Expression {
  constructor(public args: Expression[], scope: Context) {
    super(scope);
  }

  compile(): string {
    return `let accumulator = ${this.args[0].compile()}
      while(${this.args[1].compile()}(accumulator)) {accumulator = ${this.args[2]}(accumulator)}
    `;
  }
}
export class LambdaExpression extends Expression {
  constructor(
    public paramName: string,
    public body: Expression,
    scope: Context
  ) {
    super(scope);
  }

  compile(): string {
    // return `(${this.paramName}) => __CHECK_RUNTIME() && ${this.body.compile()}`;
    return `(${this.paramName}) => ${this.body.compile()}`;
  }
}
export class AssignExpression extends Expression {
  constructor(public calee: string, public body: Expression, scope: Context) {
    super(scope);
  }

  compile(): string {
    return `const ${this.calee} = ${this.body.compile()}`;
  }
}
export class AssertExpression extends Expression {
  constructor(public message: string, public body: Expression, scope: Context) {
    super(scope);
  }

  compile(): string {
    return `if (${this.body.compile()}) throw new Error(${this.message})`;
  }
}
export type Statement = AssignExpression | AssertExpression | UnsafeExpression;

export class ProgramExpression extends Expression {
  constructor(
    public statements: Statement[],
    public expression: Expression,
    scope: Context
  ) {
    super(scope);
  }

  compile(): string {
    return `(() => { 
    ${this.statements.map((s) => s.compile()).join(";\n")} 
    return ${this.expression.compile()}
  })()`;
  }
}
export class BlockExpression extends Expression {
  constructor(
    public statements: Expression[],
    public expression: Expression,
    scope: Context
  ) {
    super(scope);
  }

  compile(): string {
    return `(()=>{${this.statements.map((a) => a.compile() + ";").join("\n")}
  return ${this.expression.compile()};
})()`;
  }
}
