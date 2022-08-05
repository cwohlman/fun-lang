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

  consume() {
    if (this.position > this.input.length)
      throw new Error("Read past the end of the input");
    this.position++;
  }
}

export class ParserStack {
  constructor(public token: Token, public parent?: ParserStack) {}
}

export class Token {
  position?: [number, number] = undefined;

  start() {
    return this.position && this.position[0];
  }
  end() {
    return this.position && this.position[1];
  }
  length() {
    return this.position && this.position[1] - this.position[0];
  }

  inheritPosition(...children: (Token | undefined)[]) {
    const start = children.reduce((left, a) => {
      if (!a) return left;

      const right = a.start();
      if (left == null) return right;
      if (right == null) return left;

      return Math.min(left, right);
    }, undefined as number | undefined);
    const end = children.reduce((left, a) => {
      if (!a) return left;

      const right = a.start();
      if (left == null) return right;
      if (right == null) return left;

      return Math.max(left, right);
    }, undefined as number | undefined);

    if (start != null && end != null) this.position = [start, end];

    // could not inherit - TODO?
  }
}

export class Symbol extends Token {
  constructor(public chars: string) {
    super();
  }

  static readonly regex = /\p{Punctuation}|\p{Symbol}/u;

  static isSymbol(char: string) {
    if (Symbol.regex.test(char)) return true;
  }
}

export class Emoji extends Token {
  constructor(public chars: string) {
    super();
  }

  static readonly regex = /\p{Extended_Pictographic}/u;

  static isEmoji(char: string) {
    if (Emoji.regex.test(char)) return true;
  }
}

export class Name extends Token {
  constructor(public name: string) {
    super();
  }
  static readonly regex = /\p{Letter}/u;

  static isName(char: string) {
    if (Name.regex.test(char)) return true;
  }
}

export class Number extends Token {
  constructor(public name: string) {
    super();
  }
  static readonly regex = /\d/u;

  static isNumber(char: string) {
    if (Number.regex.test(char)) return true;
  }
}

export type WordPart = Symbol | Name | Emoji | Number | Block | Quote | Comment;

export class Word extends Token {
  constructor(public parts: WordPart[]) {
    super();

    this.inheritPosition(...parts);
  }

  static parseWord(state: ParserState): Word {
    let parts: WordPart[] = [];
    let accumulator = "";
    while (state.any()) {
      const next = state.peek();
      if (Whitespace.isWhitespace(next)) {
        if (Comment.isCommentOpener(accumulator)) {
          parts.push(Comment.parseComment(state, accumulator));
          accumulator = "";
        } else {
          return wrapUp();
        }
      }
      else if (Block.isBlockStart(next)) {
        wrapUpPart();

        parts.push(Block.parseBlock(state));
      }
      else if (Quote.isQuoteStart(next)) {
        if (!Quote.isEscapePrefix(accumulator)) wrapUpPart();

        parts.push(Quote.parseQuote(state, accumulator));
      }
      else if (Symbol.isSymbol(next)) {
        addSymbol(next);
        state.consume();
      }
      else if (Emoji.isEmoji(next)) {
        addEmoji(next);
        state.consume();
      }
      else if (Number.isNumber(next)) {
        addNumber(next);
        state.consume();
      }
      else if (Name.isName(next)) {
        addName(next);
        state.consume();
      }
      else {
        throw new Error("Unrecognized code")
      }
    }

    return wrapUp();

    function wrapUpPart() {
      if (accumulator) parts.push(getPart());
    }

    function getPart() {
      const part = accumulator;
      accumulator = "";

      if (Symbol.isSymbol(part[0])) {
        return new Symbol(part);
      }
      if (Name.isName(part[0])) {
        return new Name(part);
      }
      if (Number.isNumber(part[0])) {
        return new Number(part);
      }
      if (Emoji.isEmoji(part[0])) {
        return new Emoji(part);
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
  constructor(public chars: string) {
    super();
  }

  static readonly regex = /\s/u;

  static isWhitespace(char: string) {
    if (Whitespace.regex.test(char)) return true;
  }

  static parseWhitespace(state: ParserState): PhrasePart {
    let whitespace = "";

    while (this.isWhitespace(state.peek())) {
      whitespace += state.peek();
      state.consume();
    }

    return new Whitespace(whitespace);
  }
}

export class Comment extends Token {
  constructor(public opener: string, public chars: string) {
    super();
  }

  static readonly openerRegex = /[#]/u;
  static isCommentOpener(char: string) {
    if (Comment.openerRegex.test(char)) return true;
  }

  private static readonly commentEnderRegex = /\r\n?|\n/;
  static isCommentEnder(char: string) {
    if(Comment.commentEnderRegex.test(char)) return true;
  }

  static parseComment(state: ParserState, accumulator: string): Comment {
    let commentOpener = accumulator + state.peek();
    state.consume();

    let comment = "";
    while (! this.isCommentEnder(state.peek())) {
      comment += state.peek();
      state.consume();
    }

    return new Comment(commentOpener, comment);
  }
}

export type PhrasePart = Word | Whitespace;

export class Phrase extends Token {
  constructor(public parts: PhrasePart[]) {
    super();

    this.inheritPosition(...parts);
  }
}

export class Statement extends Token {
  constructor(public phrase: Phrase, public terminator?: Symbol) {
    super();

    this.inheritPosition(phrase, terminator);
  }

  static isTerminator(next: string) {
    return next == ";" || next == ",";
  }
}

export class Block extends Token {
  constructor(public delimiters: [Symbol, Symbol], public body: Statement[]) {
    super();

    this.inheritPosition(...delimiters, ...body);
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
    const openingParen = state.peek();
    state.consume();

    return this.parseBlockInner(openingParen, state);
  }

  static parseBlockInner(openingParen: string, state: ParserState): Block {
    let statements: Statement[] = [];
    let phrases: PhrasePart[] = [];
    while (state.any()) {
      const next = state.peek();
      if (Block.isMatchingParen(openingParen, next)) {
        state.consume();
        return wrapUp(next);
      } else if (Block.isBlockEnd(next)) {
        state.consume();
        return new ParseError("Non-matching block end") as any;
      } else if (Statement.isTerminator(next)) {
        state.consume();
        wrapUpStatement(next);
      } else if (Whitespace.isWhitespace(next)) {
        phrases.push(Whitespace.parseWhitespace(state));
      } else phrases.push(Word.parseWord(state));
    }

    return wrapUp();

    function wrapUpStatement(terminator?: string) {
      if (phrases.length)
        statements.push(
          new Statement(
            new Phrase(phrases),
            typeof terminator == "string" ? new Symbol(terminator) : undefined
          )
        );
      phrases = [];
    }

    function wrapUp(closer?: string) {
      wrapUpStatement();

      return new Block(
        [new Symbol(openingParen), new Symbol(closer || "")],
        statements
      );
    }
  }

  static parenPairs = ["{}", "[]", "()"] as const;
  static isMatchingParen(left: string, right: string): boolean {
    const matchingStart = this.parenPairs.find((p) => p[0] == left);
    if (matchingStart && matchingStart[1] != right) return false;

    const matchingEnd = this.parenPairs.find((p) => p[1] == right);
    if (matchingEnd && matchingEnd[0] != left) return false;

    // we don't recognize the paren type so any closer goes.
    return this.isBlockEnd(right);
  }
}

export class Quote extends Token {
  constructor(public delimiters: [Symbol, Symbol], public body: string) {
    super();

    this.inheritPosition(...delimiters);
  }

  static parseQuote(state: ParserState, accumulator: string): Quote {
    const openingQuote = state.peek();
    state.consume();

    const opener = accumulator + openingQuote;
    const expectedCloser = openingQuote + accumulator;

    let content = "";
    while (state.peek(expectedCloser.length) != expectedCloser) {
      const next = state.peek();
      state.consume();
      if (accumulator && next == "\\") {
        content += JSON.parse(`"${next} + ${state.peek()}"`);
        state.consume();
      } else {
        content += next;
      }
      state.consume();

      if (!state.any()) {
        return new ParseError("Expected closing quote") as any;
      }
    }

    return new Quote([new Symbol(opener), new Symbol(expectedCloser)], content);
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

export class Program extends Token {
  constructor(public statements: Statement[]) {
    super();

    this.inheritPosition(...statements);
  }

  static parseProgram(input: string) {
    const blockParser = Block.parseBlockInner("", new ParserState(input));
    return new Program(blockParser.body);
  }
}

export class ParseError extends Token {
  constructor(public message: string) {
    super();
  }
}

const output = Program.parseProgram(`
x[foo] = {
  y = foo;
  z = 100;

  y + z
}

biz[m] = x[m + 1]
`);

console.log(JSON.stringify(output, null, 2));
