"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.ParseError = exports.Program = exports.Quote = exports.Block = exports.Statement = exports.Phrase = exports.Comment = exports.Whitespace = exports.Word = exports.Number = exports.Name = exports.Emoji = exports.Symbol = exports.Token = exports.ParserStack = exports.ParserState = void 0;
var ParserState = /** @class */ (function () {
    function ParserState(input, position) {
        if (position === void 0) { position = 0; }
        this.input = input;
        this.position = position;
    }
    ParserState.prototype.any = function () {
        return this.position < this.input.length + 1;
    };
    ParserState.prototype.peek = function (length) {
        if (length === void 0) { length = 1; }
        if (length <= 0)
            throw new Error("Invalid length");
        if (length == 1)
            return this.input[this.position];
        return this.input.slice(this.position, this.position + length);
    };
    ParserState.prototype.consume = function () {
        if (this.position > this.input.length)
            throw new Error("Read past the end of the input");
        this.position++;
    };
    return ParserState;
}());
exports.ParserState = ParserState;
var ParserStack = /** @class */ (function () {
    function ParserStack(token, parent) {
        this.token = token;
        this.parent = parent;
    }
    return ParserStack;
}());
exports.ParserStack = ParserStack;
var Token = /** @class */ (function () {
    function Token() {
        this.position = undefined;
    }
    Token.prototype.start = function () {
        return this.position && this.position[0];
    };
    Token.prototype.end = function () {
        return this.position && this.position[1];
    };
    Token.prototype.length = function () {
        return this.position && this.position[1] - this.position[0];
    };
    Token.prototype.inheritPosition = function () {
        var children = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            children[_i] = arguments[_i];
        }
        var start = children.reduce(function (left, a) {
            if (!a)
                return left;
            var right = a.start();
            if (left == null)
                return right;
            if (right == null)
                return left;
            return Math.min(left, right);
        }, undefined);
        var end = children.reduce(function (left, a) {
            if (!a)
                return left;
            var right = a.start();
            if (left == null)
                return right;
            if (right == null)
                return left;
            return Math.max(left, right);
        }, undefined);
        if (start != null && end != null)
            this.position = [start, end];
        // could not inherit - TODO?
    };
    return Token;
}());
exports.Token = Token;
var Symbol = /** @class */ (function (_super) {
    __extends(Symbol, _super);
    function Symbol(chars) {
        var _this = _super.call(this) || this;
        _this.chars = chars;
        return _this;
    }
    Symbol.isSymbol = function (char) {
        if (Symbol.regex.test(char))
            return true;
    };
    Symbol.regex = /\p{Punctuation}|\p{Symbol}/u;
    return Symbol;
}(Token));
exports.Symbol = Symbol;
var Emoji = /** @class */ (function (_super) {
    __extends(Emoji, _super);
    function Emoji(chars) {
        var _this = _super.call(this) || this;
        _this.chars = chars;
        return _this;
    }
    Emoji.isEmoji = function (char) {
        if (Emoji.regex.test(char))
            return true;
    };
    Emoji.regex = /\p{Extended_Pictographic}/u;
    return Emoji;
}(Token));
exports.Emoji = Emoji;
var Name = /** @class */ (function (_super) {
    __extends(Name, _super);
    function Name(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    Name.isName = function (char) {
        if (Name.regex.test(char))
            return true;
    };
    Name.regex = /\p{Letter}/u;
    return Name;
}(Token));
exports.Name = Name;
var Number = /** @class */ (function (_super) {
    __extends(Number, _super);
    function Number(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    Number.isNumber = function (char) {
        if (Number.regex.test(char))
            return true;
    };
    Number.regex = /\d/u;
    return Number;
}(Token));
exports.Number = Number;
var Word = /** @class */ (function (_super) {
    __extends(Word, _super);
    function Word(parts) {
        var _this = _super.call(this) || this;
        _this.parts = parts;
        _this.inheritPosition.apply(_this, parts);
        return _this;
    }
    Word.parseWord = function (state) {
        var parts = [];
        var accumulator = "";
        while (state.any()) {
            var next = state.peek();
            if (Whitespace.isWhitespace(next)) {
                if (Comment.isCommentOpener(accumulator)) {
                    parts.push(Comment.parseComment(state, accumulator));
                    accumulator = "";
                }
                else {
                    return wrapUp();
                }
            }
            else if (Block.isBlockStart(next)) {
                wrapUpPart();
                parts.push(Block.parseBlock(state));
            }
            else if (Quote.isQuoteStart(next)) {
                if (!Quote.isEscapePrefix(accumulator))
                    wrapUpPart();
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
                throw new Error("Unrecognized code");
            }
        }
        return wrapUp();
        function wrapUpPart() {
            if (accumulator)
                parts.push(getPart());
        }
        function getPart() {
            var part = accumulator;
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
        function addSymbol(char) {
            if (accumulator && !Symbol.isSymbol(accumulator[0]))
                wrapUpPart();
            accumulator += char;
        }
        function addEmoji(char) {
            if (accumulator && !Emoji.isEmoji(accumulator[0]))
                wrapUpPart();
            accumulator += char;
        }
        function addNumber(char) {
            if (accumulator && !Number.isNumber(accumulator[0]))
                wrapUpPart();
            accumulator += char;
        }
        function addName(char) {
            if (accumulator && !Name.isName(accumulator[0]))
                wrapUpPart();
            accumulator += char;
        }
        function wrapUp() {
            wrapUpPart();
            return new Word(parts);
        }
    };
    return Word;
}(Token));
exports.Word = Word;
var Whitespace = /** @class */ (function (_super) {
    __extends(Whitespace, _super);
    function Whitespace(chars) {
        var _this = _super.call(this) || this;
        _this.chars = chars;
        return _this;
    }
    Whitespace.isWhitespace = function (char) {
        if (Whitespace.regex.test(char))
            return true;
    };
    Whitespace.parseWhitespace = function (state) {
        var whitespace = "";
        while (this.isWhitespace(state.peek())) {
            whitespace += state.peek();
            state.consume();
        }
        return new Whitespace(whitespace);
    };
    Whitespace.regex = /\s/u;
    return Whitespace;
}(Token));
exports.Whitespace = Whitespace;
var Comment = /** @class */ (function (_super) {
    __extends(Comment, _super);
    function Comment(opener, chars) {
        var _this = _super.call(this) || this;
        _this.opener = opener;
        _this.chars = chars;
        return _this;
    }
    Comment.isCommentOpener = function (char) {
        if (Comment.openerRegex.test(char))
            return true;
    };
    Comment.isCommentEnder = function (char) {
        if (Comment.commentEnderRegex.test(char))
            return true;
    };
    Comment.parseComment = function (state, accumulator) {
        var commentOpener = accumulator + state.peek();
        state.consume();
        var comment = "";
        while (!this.isCommentEnder(state.peek())) {
            comment += state.peek();
            state.consume();
        }
        return new Comment(commentOpener, comment);
    };
    Comment.openerRegex = /[#]/u;
    Comment.commentEnderRegex = /\r\n?|\n/;
    return Comment;
}(Token));
exports.Comment = Comment;
var Phrase = /** @class */ (function (_super) {
    __extends(Phrase, _super);
    function Phrase(parts) {
        var _this = _super.call(this) || this;
        _this.parts = parts;
        _this.inheritPosition.apply(_this, parts);
        return _this;
    }
    return Phrase;
}(Token));
exports.Phrase = Phrase;
var Statement = /** @class */ (function (_super) {
    __extends(Statement, _super);
    function Statement(phrase, terminator) {
        var _this = _super.call(this) || this;
        _this.phrase = phrase;
        _this.terminator = terminator;
        _this.inheritPosition(phrase, terminator);
        return _this;
    }
    Statement.isTerminator = function (next) {
        return next == ";" || next == ",";
    };
    return Statement;
}(Token));
exports.Statement = Statement;
var Block = /** @class */ (function (_super) {
    __extends(Block, _super);
    function Block(delimiters, body) {
        var _this = _super.call(this) || this;
        _this.delimiters = delimiters;
        _this.body = body;
        _this.inheritPosition.apply(_this, __spreadArrays(delimiters, body));
        return _this;
    }
    Block.isBlockStart = function (char) {
        return this.blockStartRegex.test(char);
    };
    Block.isBlockEnd = function (char) {
        return this.blockEndRegex.test(char);
    };
    // TODO: matching pairs of brackets
    Block.parseBlock = function (state) {
        var openingParen = state.peek();
        state.consume();
        return this.parseBlockInner(openingParen, state);
    };
    Block.parseBlockInner = function (openingParen, state) {
        var statements = [];
        var phrases = [];
        while (state.any()) {
            var next = state.peek();
            if (Block.isMatchingParen(openingParen, next)) {
                state.consume();
                return wrapUp(next);
            }
            else if (Block.isBlockEnd(next)) {
                state.consume();
                return new ParseError("Non-matching block end");
            }
            else if (Statement.isTerminator(next)) {
                state.consume();
                wrapUpStatement(next);
            }
            else if (Whitespace.isWhitespace(next)) {
                phrases.push(Whitespace.parseWhitespace(state));
            }
            else
                phrases.push(Word.parseWord(state));
        }
        return wrapUp();
        function wrapUpStatement(terminator) {
            if (phrases.length)
                statements.push(new Statement(new Phrase(phrases), typeof terminator == "string" ? new Symbol(terminator) : undefined));
            phrases = [];
        }
        function wrapUp(closer) {
            wrapUpStatement();
            return new Block([new Symbol(openingParen), new Symbol(closer || "")], statements);
        }
    };
    Block.isMatchingParen = function (left, right) {
        var matchingStart = this.parenPairs.find(function (p) { return p[0] == left; });
        if (matchingStart && matchingStart[1] != right)
            return false;
        var matchingEnd = this.parenPairs.find(function (p) { return p[1] == right; });
        if (matchingEnd && matchingEnd[0] != left)
            return false;
        // we don't recognize the paren type so any closer goes.
        return this.isBlockEnd(right);
    };
    Block.blockStartRegex = /\p{Open_Punctuation}/u;
    Block.blockEndRegex = /\p{Close_Punctuation}/u;
    Block.parenPairs = ["{}", "[]", "()"];
    return Block;
}(Token));
exports.Block = Block;
var Quote = /** @class */ (function (_super) {
    __extends(Quote, _super);
    function Quote(delimiters, body) {
        var _this = _super.call(this) || this;
        _this.delimiters = delimiters;
        _this.body = body;
        _this.inheritPosition.apply(_this, delimiters);
        return _this;
    }
    Quote.parseQuote = function (state, accumulator) {
        var openingQuote = state.peek();
        state.consume();
        var opener = accumulator + openingQuote;
        var expectedCloser = openingQuote + accumulator;
        var content = "";
        while (state.peek(expectedCloser.length) != expectedCloser) {
            var next = state.peek();
            state.consume();
            if (accumulator && next == "\\") {
                content += JSON.parse("\"" + next + " + " + state.peek() + "\"");
                state.consume();
            }
            else {
                content += next;
            }
            state.consume();
            if (!state.any()) {
                return new ParseError("Expected closing quote");
            }
        }
        return new Quote([new Symbol(opener), new Symbol(expectedCloser)], content);
    };
    Quote.isQuote = function (char) {
        if (Quote.regex.test(char))
            return true;
    };
    Quote.isQuoteStart = function (char) {
        return this.isQuote(char);
    };
    Quote.isEscapePrefix = function (accumulator) {
        return Quote.escapePrefixRegex.test(accumulator);
    };
    Quote.regex = /\p{Quotation_Mark}|[`´]/u;
    Quote.escapePrefixRegex = /#+/;
    return Quote;
}(Token));
exports.Quote = Quote;
var Program = /** @class */ (function (_super) {
    __extends(Program, _super);
    function Program(statements) {
        var _this = _super.call(this) || this;
        _this.statements = statements;
        _this.inheritPosition.apply(_this, statements);
        return _this;
    }
    Program.parseProgram = function (input) {
        var blockParser = Block.parseBlockInner("", new ParserState(input));
        return new Program(blockParser.body);
    };
    return Program;
}(Token));
exports.Program = Program;
var ParseError = /** @class */ (function (_super) {
    __extends(ParseError, _super);
    function ParseError(message) {
        var _this = _super.call(this) || this;
        _this.message = message;
        return _this;
    }
    return ParseError;
}(Token));
exports.ParseError = ParseError;
var output = Program.parseProgram("\nx[foo] = {\n  y = foo;\n  z = 100;\n\n  y + z\n}\n\nbiz[m] = x[m + 1]\n");
console.log(JSON.stringify(output, null, 2));
