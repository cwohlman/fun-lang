"use strict";
exports.__esModule = true;
exports.exec = exports.makeStdLibContext = void 0;
var Parser_1 = require("./Parser");
var stdLib = new Parser_1.Context();
var statements = [];
exports.makeStdLibContext = function () { return ({
    statements: [],
    context: stdLib.copy()
}); };
exports.exec = function (source, lib) {
    if (lib === void 0) { lib = exports.makeStdLibContext(); }
    var expression = new Parser_1.Parser(source, 0, lib.context).parseProgram();
    expression.statements = statements.concat(expression.statements);
    // console.log(expression);
    var compiled = expression.compile();
    console.log(compiled);
    var result = eval(compiled);
    return result;
};
function addStdFn(name, body) {
    var expression = new Parser_1.AssignExpression(name, new Parser_1.UnsafeExpression(body, stdLib), stdLib);
    statements.push(expression);
    stdLib.addName(name, expression);
}
// Not a standard lib fn, not accessible from the runtime
// TODO: protect this from being stomped on by user fns.
statements.push(new Parser_1.AssignExpression("__CHECK_RUNTIME", new Parser_1.UnsafeExpression("() => {__CHECK_RUNTIME.counter ++; if (__CHECK_RUNTIME.counter > 10_000) throw new Error('Maxiumum runtime exceeded'); return true; }", stdLib), stdLib));
statements.push(new Parser_1.UnsafeExpression("__CHECK_RUNTIME.counter = 0", stdLib));
statements.push(new Parser_1.AssignExpression("error", new Parser_1.UnsafeExpression("(message) => { throw new Error(message); }", stdLib), stdLib));
addStdFn("object", "() => new Map()");
addStdFn("array", "() => []");
addStdFn("set", "(obj, key, value) => obj instanceof Map ? obj.set(key, value) : obj instanceof Array ? obj[Number(key)] = value : error('not a valid object')");
addStdFn("get", "(obj, key) => obj instanceof Map ? obj.get(key) : obj instanceof Array ? obj[Number(key)] : error('not a valid object')");
addStdFn("push", "(obj, value) => obj instanceof Array ? obj.push(value) : error('not a valid object')");
addStdFn("pop", "(obj) => obj instanceof Array ? obj.pop() : error('not a valid object')");
addStdFn("multiply", "(a, b) => a * b");
addStdFn("divide", "(a, b) => a / b");
addStdFn("add", "(a, b) => a + b");
addStdFn("subtract", "(a, b) => a - b");
addStdFn("negate", "(a) => - a");
addStdFn("not", "(a) => ! a");
addStdFn("eq", "(a, b) => a == b");
addStdFn("neq", "(a, b) => a != b");
addStdFn("eqq", "(a, b) => a === b");
addStdFn("gt", "(a, b) => a > b");
addStdFn("lt", "(a, b) => a < b");
addStdFn("gte", "(a, b) => a >= b");
addStdFn("lte", "(a, b) => a <= b");
// TODO: whole standard lib
console.log(exports.exec("\n\nfactorial = a>\n  cond(\n    eq(a, 1), \n    1, \n    multiply(\n      a, \n      factorial(\n        subtract(a, 1)\n      )\n    )\n  )\n  ;\n\ngizard = a>b>add(a, b);\nallow = person>eq(get(person, \"name\"),\"joshua\");\ncreatePerson = name>{person = object(); setResult = set(person, \"name\", name); person};\n\nadd(\n  add(\n    \"gizard(1)(2) = \",\n    gizard(1)(2)\n  ),\n  add(\n    add(\n      \"\\nallow(\\\"joshua\\\") = \",\n      allow(createPerson(\"joshua\"))\n    ),\n    add(\n      \"\\nfactorial(6)\", \n      add(\n        \" = \", \n        factorial(6)\n      )\n    )\n  )\n)\n\n"));
