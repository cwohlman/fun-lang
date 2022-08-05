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
exports.__esModule = true;
exports.BlockExpression = exports.ProgramExpression = exports.AssertExpression = exports.AssignExpression = exports.LambdaExpression = exports.LoopExpression = exports.ConditionalExpression = exports.CallExpression = exports.ParamExpression = exports.LiteralExpression = exports.NameExpression = exports.UnsafeExpression = exports.Expression = exports.Context = exports.Parser = void 0;
var Parser = /** @class */ (function () {
    function Parser(input, index, context) {
        if (index === void 0) { index = 0; }
        if (context === void 0) { context = new Context(); }
        this.input = input;
        this.index = index;
        this.context = context;
    }
    Parser.prototype.peek = function () {
        return this.input[this.index];
    };
    Parser.prototype.consume = function () {
        if (this.index >= this.input.length)
            this.error("Did not stop");
        this.index++;
    };
    Parser.prototype.remainder = function () {
        return this.input.slice(this.index);
    };
    Parser.prototype.error = function (message) {
        throw new Error(message + " - " + this.remainder());
    };
    Parser.prototype.consumeWhitespace = function () {
        while (/\s/.test(this.peek())) {
            this.consume();
        }
    };
    // [statement; statement; statement;] expression
    Parser.prototype.parseProgram = function () {
        var statements = [];
        var expression = null;
        while (true) {
            this.consumeWhitespace();
            var parsed = this.parseExpression();
            if (!parsed)
                break;
            this.consumeWhitespace();
            var terminator = this.peek();
            if (terminator == ";") {
                this.checkStatement(parsed);
                statements.push(parsed);
                this.consume();
            }
            else {
                expression = parsed;
                break;
            }
        }
        if (!expression) {
            this.error("Expected expression in program.");
        }
        return new ProgramExpression(statements, expression, this.context);
    };
    Parser.prototype.checkStatement = function (expression) {
        if (expression instanceof AssertExpression)
            return;
        if (expression instanceof AssignExpression)
            return;
        this.error("Expected statement");
    };
    // { block }
    // name
    // name(arguments)
    // parameter>expression
    Parser.prototype.parseExpression = function () {
        this.consumeWhitespace();
        var firstChar = this.peek();
        if (firstChar == "{") {
            this.consume();
            return this.parseBlock();
        }
        if (firstChar == '"') {
            this.consume();
            return this.parseLiteral();
        }
        var name = this.parseName();
        this.consumeWhitespace();
        if (!name)
            return null;
        return this.parseExpressionWithName(name);
    };
    Parser.prototype.requireExpression = function () {
        var expression = this.parseExpression();
        if (!expression)
            this.error("Expression expected");
        return expression;
    };
    Parser.prototype.parseExpressionWithName = function (name) {
        var follower = this.peek();
        if (follower == "(") {
            this.consume();
            var result = this.parseCall(name);
            return this.maybeParseCall(result);
        }
        if (follower == ">") {
            this.consume();
            return this.parseLambda(name);
        }
        if (follower == "=") {
            this.consume();
            this.consumeWhitespace();
            return this.context.addName(name, new AssignExpression(name, this.requireExpression(), this.context));
        }
        if (follower == "!") {
            this.consume();
            this.consumeWhitespace();
            return this.context.addName(name, new AssertExpression(name, this.requireExpression(), this.context));
        }
        return new NameExpression(name, this.context);
    };
    Parser.prototype.maybeParseCall = function (left) {
        this.consumeWhitespace();
        var next = this.peek();
        if (next == "(") {
            this.consume();
            return this.parseOuterCall(left);
        }
        return left;
    };
    Parser.prototype.parseOuterCall = function (left) {
        var args = this.parseArguments();
        this.consumeWhitespace();
        var closer = this.peek();
        if (closer != ")") {
            this.error("Expected closing paren");
        }
        this.consume();
        return new CallExpression(left, args, this.context);
    };
    Parser.prototype.parseCall = function (callee) {
        var args = this.parseArguments();
        this.consumeWhitespace();
        var closer = this.peek();
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
    };
    Parser.prototype.parseBlock = function () {
        this.consumeWhitespace();
        this.context = new Context(this.context);
        var result = this.parseProgram();
        this.consumeWhitespace();
        var closer = this.peek();
        if (closer != "}")
            this.error("Expected closing }");
        this.consume();
        this.context = this.context.parent;
        return new BlockExpression(result.statements, result.expression, this.context);
    };
    // expression, expression, expression[,]
    Parser.prototype.parseArguments = function () {
        var results = [];
        while (true) {
            var arg = this.parseExpression();
            if (!arg)
                break;
            results.push(arg);
            this.consumeWhitespace();
            if (this.peek() != ",")
                break;
            this.consume();
        }
        return results;
    };
    // param>expression
    Parser.prototype.parseLambda = function (name) {
        this.context = new Context(this.context);
        this.context.addName(name, new ParamExpression(name, this.context));
        var expression = this.parseExpression();
        if (!expression)
            this.error("Expected expression on left hand side of lambda");
        this.context = this.context.parent;
        return new LambdaExpression(name, expression, this.context);
    };
    Parser.prototype.parseName = function () {
        this.consumeWhitespace();
        var name = "";
        var next = this.peek();
        while (/[a-z0-9_@]/i.test(next)) {
            this.consume();
            name += next;
            next = this.peek();
        }
        return name;
    };
    Parser.prototype.parseLiteral = function () {
        var value = "";
        while (true) {
            var next = this.peek();
            this.consume();
            if (!next) {
                throw new Error("Unterminated string");
            }
            if (next == '"') {
                return new LiteralExpression(value, this.context);
            }
            if (next == "\\") {
                var escaped = this.peek();
                if (!escaped)
                    throw new Error("trailing escape sequence");
                value += JSON.parse("\"\\" + escaped + "\"");
                this.consume();
                continue;
            }
            value += next;
        }
    };
    return Parser;
}());
exports.Parser = Parser;
var Context = /** @class */ (function () {
    function Context(parent) {
        this.parent = parent;
        this.names = new Map();
    }
    Context.prototype.copy = function () {
        var copy = new Context();
        // @ts-ignore
        copy.names = new Map(this.names);
        return copy;
    };
    Context.prototype.getLocalName = function (name) {
        var existingName = this.names.get(name);
        if (existingName)
            return existingName;
        else
            this.names.set(name, new NameExpression(name, this));
        return this.names.get(name); // We know it's not undefined here because we set it above
    };
    Context.prototype.getName = function (name) {
        var existingName = this.peekName(name);
        if (existingName)
            return existingName;
        else
            this.names.set(name, new NameExpression(name, this));
        return this.names.get(name); // We know it's not undefined here because we set it above
    };
    Context.prototype.peekName = function (name) {
        if (this.names.has(name)) {
            return this.names.get(name);
        }
        if (this.parent)
            return this.parent.peekName(name);
        return null;
    };
    Context.prototype.addName = function (name, expression) {
        if (this.names.has(name)) {
            throw new Error("Name already exists locally");
        }
        this.names.set(name, expression);
        return expression;
    };
    return Context;
}());
exports.Context = Context;
var Expression = /** @class */ (function () {
    function Expression(scope) {
        this.scope = scope;
    }
    Expression.prototype.compile = function () {
        throw new Error("Not implemented: " + this.constructor.name);
    };
    return Expression;
}());
exports.Expression = Expression;
var UnsafeExpression = /** @class */ (function (_super) {
    __extends(UnsafeExpression, _super);
    function UnsafeExpression(rawJS, scope) {
        var _this = _super.call(this, scope) || this;
        _this.rawJS = rawJS;
        return _this;
    }
    UnsafeExpression.prototype.compile = function () {
        return this.rawJS;
    };
    return UnsafeExpression;
}(Expression));
exports.UnsafeExpression = UnsafeExpression;
var NameExpression = /** @class */ (function (_super) {
    __extends(NameExpression, _super);
    function NameExpression(name, scope) {
        var _this = _super.call(this, scope) || this;
        _this.name = name;
        return _this;
    }
    NameExpression.prototype.compile = function () {
        // numbers
        if (/(\d+_)*\d+(\.\d+)?/.test(this.name))
            return this.name;
        // unrecognized names
        if (!this.scope.peekName(this.name))
            throw new Error("Unrecognized name: " + this.name);
        // recognized names
        return this.name;
    };
    return NameExpression;
}(Expression));
exports.NameExpression = NameExpression;
var LiteralExpression = /** @class */ (function (_super) {
    __extends(LiteralExpression, _super);
    function LiteralExpression(value, scope) {
        var _this = _super.call(this, scope) || this;
        _this.value = value;
        return _this;
    }
    LiteralExpression.prototype.compile = function () {
        return JSON.stringify(this.value);
    };
    return LiteralExpression;
}(Expression));
exports.LiteralExpression = LiteralExpression;
var ParamExpression = /** @class */ (function (_super) {
    __extends(ParamExpression, _super);
    function ParamExpression(name, scope) {
        var _this = _super.call(this, scope) || this;
        _this.name = name;
        return _this;
    }
    ParamExpression.prototype.compile = function () {
        return this.name;
    };
    return ParamExpression;
}(Expression));
exports.ParamExpression = ParamExpression;
var CallExpression = /** @class */ (function (_super) {
    __extends(CallExpression, _super);
    function CallExpression(calee, args, scope) {
        var _this = _super.call(this, scope) || this;
        _this.calee = calee;
        _this.args = args;
        return _this;
    }
    CallExpression.prototype.compile = function () {
        return this.calee.compile() + "(" + this.args.map(function (arg) { return arg.compile(); }).join(", ") + ")";
    };
    return CallExpression;
}(Expression));
exports.CallExpression = CallExpression;
var ConditionalExpression = /** @class */ (function (_super) {
    __extends(ConditionalExpression, _super);
    function ConditionalExpression(args, scope) {
        var _this = _super.call(this, scope) || this;
        _this.args = args;
        if (args.length != 3)
            throw new Error("Invalid number of args");
        return _this;
    }
    ConditionalExpression.prototype.compile = function () {
        return this.args[0].compile() + " ? " + this.args[1].compile() + " : " + this.args[2].compile();
    };
    return ConditionalExpression;
}(Expression));
exports.ConditionalExpression = ConditionalExpression;
var LoopExpression = /** @class */ (function (_super) {
    __extends(LoopExpression, _super);
    function LoopExpression(args, scope) {
        var _this = _super.call(this, scope) || this;
        _this.args = args;
        return _this;
    }
    LoopExpression.prototype.compile = function () {
        return "let accumulator = " + this.args[0].compile() + "\n      while(" + this.args[1].compile() + "(accumulator)) {accumulator = " + this.args[2] + "(accumulator)}\n    ";
    };
    return LoopExpression;
}(Expression));
exports.LoopExpression = LoopExpression;
var LambdaExpression = /** @class */ (function (_super) {
    __extends(LambdaExpression, _super);
    function LambdaExpression(paramName, body, scope) {
        var _this = _super.call(this, scope) || this;
        _this.paramName = paramName;
        _this.body = body;
        return _this;
    }
    LambdaExpression.prototype.compile = function () {
        // return `(${this.paramName}) => __CHECK_RUNTIME() && ${this.body.compile()}`;
        return "(" + this.paramName + ") => " + this.body.compile();
    };
    return LambdaExpression;
}(Expression));
exports.LambdaExpression = LambdaExpression;
var AssignExpression = /** @class */ (function (_super) {
    __extends(AssignExpression, _super);
    function AssignExpression(calee, body, scope) {
        var _this = _super.call(this, scope) || this;
        _this.calee = calee;
        _this.body = body;
        return _this;
    }
    AssignExpression.prototype.compile = function () {
        return "const " + this.calee + " = " + this.body.compile();
    };
    return AssignExpression;
}(Expression));
exports.AssignExpression = AssignExpression;
var AssertExpression = /** @class */ (function (_super) {
    __extends(AssertExpression, _super);
    function AssertExpression(message, body, scope) {
        var _this = _super.call(this, scope) || this;
        _this.message = message;
        _this.body = body;
        return _this;
    }
    AssertExpression.prototype.compile = function () {
        return "if (" + this.body.compile() + ") throw new Error(" + this.message + ")";
    };
    return AssertExpression;
}(Expression));
exports.AssertExpression = AssertExpression;
var ProgramExpression = /** @class */ (function (_super) {
    __extends(ProgramExpression, _super);
    function ProgramExpression(statements, expression, scope) {
        var _this = _super.call(this, scope) || this;
        _this.statements = statements;
        _this.expression = expression;
        return _this;
    }
    ProgramExpression.prototype.compile = function () {
        return "(() => { \n    " + this.statements.map(function (s) { return s.compile(); }).join(";\n") + " \n    return " + this.expression.compile() + "\n  })()";
    };
    return ProgramExpression;
}(Expression));
exports.ProgramExpression = ProgramExpression;
var BlockExpression = /** @class */ (function (_super) {
    __extends(BlockExpression, _super);
    function BlockExpression(statements, expression, scope) {
        var _this = _super.call(this, scope) || this;
        _this.statements = statements;
        _this.expression = expression;
        return _this;
    }
    BlockExpression.prototype.compile = function () {
        return "(()=>{" + this.statements.map(function (a) { return a.compile() + ";"; }).join("\n") + "\n  return " + this.expression.compile() + ";\n})()";
    };
    return BlockExpression;
}(Expression));
exports.BlockExpression = BlockExpression;
