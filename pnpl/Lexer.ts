export class ParserState {
  constructor(public readonly input: string, public position: number = 0) {}

  any() {
    return this.position < this.input.length + 1;
  }

  peek(length: number = 1) {
    if (length <= 0) throw new Error("Invalid length");
    if (length == 1) return this.input[this.position];
    return this.input.slice(this.position, this.position + length);
  }

  consume(length: number = 1) {
    if (this.position > this.input.length)
      throw new Error("Read past the end of the input");

    this.position += length;
  }
}

export class ParserStack {
  constructor(public token: Token, public parent?: ParserStack) {}
}

export class Token {
  constructor(public position: [number, number]) {}

  start() {
    return this.position && this.position[0];
  }
  end() {
    return this.position && this.position[1];
  }
  length() {
    return this.position && this.position[1] - this.position[0];
  }
}

export class ParentToken extends Token {
  constructor(childTokens: Token[]) {
    super(ParentToken.getPosition(...childTokens));
  }

  static getPosition(...children: (Token | undefined)[]): [number, number] {
    const start = children.reduce((left, a) => {
      if (!a) return left;

      const right = a.start();
      if (left == null) return right;
      if (right == null) return left;

      return Math.min(left, right);
    }, undefined as number | undefined);
    const end = children.reduce((left, a) => {
      if (!a) return left;

      const right = a.end();
      if (left == null) return right;
      if (right == null) return left;

      return Math.max(left, right);
    }, undefined as number | undefined);

    return [start!, end!];
  }
}

export class Symbol extends Token {
  constructor(public chars: string, position: [number, number]) {
    super(position);
  }

  static readonly regex = /\p{Punctuation}|\p{Symbol}/u;

  static isSymbol(char: string) {
    if (Symbol.regex.test(char)) return true;
  }
}

export class Emoji extends Token {
  constructor(public chars: string, position: [number, number]) {
    super(position);
  }

  static readonly regex = /\p{Extended_Pictographic}/u;

  static isEmoji(char: string) {
    if (Emoji.regex.test(char)) return true;
  }
}

export class Name extends Token {
  constructor(public name: string, position: [number, number]) {
    super(position);
  }
  static readonly regex = /\p{Letter}/u;

  static isName(char: string) {
    if (Name.regex.test(char)) return true;
  }
}

export class Number extends Token {
  constructor(public name: string, position: [number, number]) {
    super(position);
  }
  static readonly regex = /\d/u;

  static isNumber(char: string) {
    if (Number.regex.test(char)) return true;
  }
}

export type WordPart = Symbol | Name | Emoji | Number | Block | Quote | Comment;

export class Word extends ParentToken {
  constructor(public parts: WordPart[]) {
    super(parts);
  }

  static parseWord(state: ParserState): Word {
    let parts: WordPart[] = [];
    let accumulator = "";
    let startIndex = state.position;
    while (state.any()) {
      const next = state.peek();
      if (Whitespace.isWhitespace(next)) {
        if (Comment.isCommentOpener(accumulator)) {
          parts.push(Comment.parseComment(state, accumulator));
          accumulator = "";
        } else {
          return wrapUp();
        }
      } else if (Block.isBlockStart(next)) {
        wrapUpPart();

        parts.push(Block.parseBlock(state));
      } else if (Quote.isQuoteStart(next)) {
        if (!Quote.isEscapePrefix(accumulator)) wrapUpPart();

        parts.push(Quote.parseQuote(state, accumulator));
      } else if (Symbol.isSymbol(next)) {
        addSymbol(next);
        state.consume();
      } else if (Emoji.isEmoji(next)) {
        addEmoji(next);
        state.consume();
      } else if (Number.isNumber(next)) {
        addNumber(next);
        state.consume();
      } else if (Name.isName(next)) {
        addName(next);
        state.consume();
      } else {
        throw new Error("Unrecognized code");
      }
    }

    return wrapUp();

    function wrapUpPart() {
      if (accumulator) parts.push(getPart());
    }

    function getPart() {
      const part = accumulator;
      const start = startIndex;
      const end = state.position; // TODO: is this off by one?

      accumulator = "";

      if (Symbol.isSymbol(part[0])) {
        return new Symbol(part, [start, end]);
      }
      if (Name.isName(part[0])) {
        return new Name(part, [start, end]);
      }
      if (Number.isNumber(part[0])) {
        return new Number(part, [start, end]);
      }
      if (Emoji.isEmoji(part[0])) {
        return new Emoji(part, [start, end]);
      }

      throw new Error("Unrecognized word part:" + part);
    }
    function addSymbol(char: string) {
      if (accumulator && !Symbol.isSymbol(accumulator[0])) wrapUpPart();

      accumulator += char;
    }
    function addEmoji(char: string) {
      if (accumulator && !Emoji.isEmoji(accumulator[0])) wrapUpPart();

      accumulator += char;
    }
    function addNumber(char: string) {
      if (accumulator && !Number.isNumber(accumulator[0])) wrapUpPart();

      accumulator += char;
    }
    function addName(char: string) {
      if (accumulator && !Name.isName(accumulator[0])) wrapUpPart();

      accumulator += char;
    }

    function wrapUp() {
      wrapUpPart();

      return new Word(parts);
    }
  }
}

export class Whitespace extends Token {
  constructor(public chars: string, position: [number, number]) {
    super(position);
  }

  static readonly regex = /\s/u;

  static isWhitespace(char: string) {
    if (Whitespace.regex.test(char)) return true;
  }

  static parseWhitespace(state: ParserState): PhrasePart {
    let whitespace = "";
    let start = state.position;

    while (this.isWhitespace(state.peek())) {
      whitespace += state.peek();
      state.consume();
    }
    let end = state.position;

    return new Whitespace(whitespace, [start, end]);
  }
}

export class Comment extends Token {
  constructor(
    public opener: string,
    public chars: string,
    position: [number, number]
  ) {
    super(position);
  }

  static readonly openerRegex = /[#]/u;
  static isCommentOpener(char: string) {
    if (Comment.openerRegex.test(char)) return true;
  }

  private static readonly commentEnderRegex = /\r\n?|\n/;
  static isCommentEnder(char: string) {
    if (Comment.commentEnderRegex.test(char)) return true;
  }

  static parseComment(state: ParserState, accumulator: string): Comment {
    let commentOpener = accumulator + state.peek();
    state.consume();
    let start = state.position;

    let comment = "";
    while (!this.isCommentEnder(state.peek())) {
      comment += state.peek();
      state.consume();
    }
    let end = state.position;

    return new Comment(commentOpener, comment, [start, end]);
  }
}

export type PhrasePart = Word | Whitespace;

export class Phrase extends ParentToken {
  constructor(public parts: PhrasePart[]) {
    super(parts);
  }
}

export class Statement extends ParentToken {
  constructor(public phrase: Phrase, public terminator?: Symbol) {
    super([phrase, terminator].filter((a) => a) as Token[]);
  }

  static isTerminator(next: string) {
    return next == ";" || next == ",";
  }
}

export class Block extends ParentToken {
  constructor(public delimiters: [Symbol, Symbol], public body: Statement[]) {
    super([...delimiters, ...body]);
  }

  static blockStartRegex = /\p{Open_Punctuation}/u;
  static isBlockStart(char: string) {
    return this.blockStartRegex.test(char);
  }
  static blockEndRegex = /\p{Close_Punctuation}/u;
  static isBlockEnd(char: string) {
    return this.blockEndRegex.test(char);
  }

  // TODO: matching pairs of brackets

  static parseBlock(state: ParserState): Block {
    const openingParen = new Symbol(state.peek(), [
      state.position,
      state.position,
    ]);
    state.consume();

    return this.parseBlockInner(openingParen, state);
  }

  static parseBlockInner(openingParen: Symbol, state: ParserState): Block {
    let statements: Statement[] = [];
    let phrases: PhrasePart[] = [];
    while (state.any()) {
      const next = state.peek();
      if (Block.isMatchingParen(openingParen, next)) {
        const closer = new Symbol(next, [state.position, state.position]);
        state.consume();

        return wrapUp(closer);
      } else if (Block.isBlockEnd(next)) {
        const closer = new Symbol(next, [state.position, state.position]);
        state.consume();

        return new ParseError("Non-matching block end", [
          ...statements,
          ...phrases,
          closer,
        ]) as any;
      } else if (Statement.isTerminator(next)) {
        const terminator = new Symbol(next, [state.position, state.position]);
        wrapUpStatement(terminator);
        state.consume();
      } else if (Whitespace.isWhitespace(next)) {
        phrases.push(Whitespace.parseWhitespace(state));
      } else phrases.push(Word.parseWord(state));
    }

    return wrapUp();

    function wrapUpStatement(terminator?: Symbol) {
      if (phrases.length)
        statements.push(new Statement(new Phrase(phrases), terminator));
      phrases = [];
    }

    function wrapUp(closer?: Symbol) {
      wrapUpStatement();

      return new Block([openingParen, closer!], statements);
    }
  }

  static parenPairs = ["{}", "[]", "()"] as const;
  static isMatchingParen(leftSymbol: Symbol, right: string): boolean {
    const left = leftSymbol.chars;
    const matchingStart = this.parenPairs.find((p) => p[0] == left);
    if (matchingStart && matchingStart[1] != right) return false;

    const matchingEnd = this.parenPairs.find((p) => p[1] == right);
    if (matchingEnd && matchingEnd[0] != left) return false;

    // we don't recognize the paren type so any closer goes.
    return this.isBlockEnd(right);
  }
}

export class Quote extends Token {
  constructor(
    public delimiters: [Symbol, Symbol],
    public body: string,
    position: [number, number]
  ) {
    super(position);
  }

  static parseQuote(state: ParserState, accumulator: string): Quote {
    const openingQuote = state.peek();
    const start = state.position;

    state.consume();

    const opener = accumulator + openingQuote;
    const openerSymbol = new Symbol(openingQuote, [
      state.position,
      state.position,
    ]);
    const expectedCloser = openingQuote + accumulator;
    const closerLength = expectedCloser.length;

    let content = "";
    while (state.peek(closerLength) != expectedCloser) {
      const next = state.peek();
      state.consume();
      if (accumulator && next == "\\") {
        content += JSON.parse(`"${next} + ${state.peek()}"`);
        state.consume();
      } else {
        content += next;
      }

      if (!state.any()) {
        const end = state.position;
        return new ParseError("Expected closing quote", [
          new Quote(
            [openerSymbol, new Symbol("", [state.position, state.position])],
            content,
            [start, end]
          ),
        ]) as any;
      }
    }
    const closer = new Symbol(state.peek(closerLength), [
      state.position,
      state.position + closerLength,
    ]);
    state.consume(closerLength);

    const end = state.position;

    return new Quote([openerSymbol, closer], content, [start, end]);
  }

  static readonly regex = /\p{Quotation_Mark}|[`´]/u;

  static isQuote(char: string) {
    if (Quote.regex.test(char)) return true;
  }
  static isQuoteStart(char: string) {
    return this.isQuote(char);
  }

  static readonly escapePrefixRegex = /#+/;

  static isEscapePrefix(accumulator: string) {
    return Quote.escapePrefixRegex.test(accumulator);
  }
}

export class Program extends ParentToken {
  constructor(public statements: Statement[]) {
    super(statements);
  }

  static parseProgram(input: string) {
    const blockParser = Block.parseBlockInner(
      new Symbol("", [0, 0]),
      new ParserState(input)
    );
    return new Program(blockParser.body);
  }
}

export class ParseError extends ParentToken {
  constructor(public message: string, childTokens: Token[]) {
    super(childTokens);
  }
}

const expressions = `
x[foo]
a(b)
f{z}
m\`foo\`
m'foo'
m"foo"
m ##'foo'##
m #####'foo'#####
m\`foo\`
biz baz buz
foo(bar, bim, bam)
! @ Foo BAR.BIM
`.split("\n");
function makeRunner(lines: number, depth: number) {
  let program = "";
  let currentDepth = 0;
  let currentLine = 0;
  let ascending = true;

  while (currentLine < lines) {
    let newLine = expressions[currentLine % expressions.length];
    if (ascending) {
      if (currentDepth < depth) {
        currentDepth++;
        newLine += " = {";
      } else {
        ascending = false;
      }
    } else {
      if (currentDepth > 0) {
        currentDepth--;
        newLine += " }"
      } else {
        ascending = true;
      }
    }

    program += new Array(currentDepth).fill("  ").join("") +  newLine + "\n"

    currentLine++;
  }

  console.log(program);

  return () => {
    return Program.parseProgram(program);
    // console.log(compiled.length());
  }
}
const run = makeRunner(1_000, 1);
const start = Date.now();

for (var i = 0; i < 1_000; i++) {
  const result = run();

  if (i == 0) console.log(result);
}

const end = Date.now();

console.log(end - start);

// console.log(JSON.stringify(output, null, 2));
