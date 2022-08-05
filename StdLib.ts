import { AssignExpression, Context, Parser, Statement, UnsafeExpression } from "./Parser";

const stdLib = new Context();
const statements: Statement[] = [];

export const makeStdLibContext = () => ({
  statements: [],
  context: stdLib.copy(),
});

export const exec = (
  source: string,
  lib: { statements: Statement[]; context: Context } = makeStdLibContext()
) => {
  const expression = new Parser(source, 0, lib.context).parseProgram();

  expression.statements = statements.concat(expression.statements);

  // console.log(expression);

  const compiled = expression.compile();

  console.log(compiled);

  const result = eval(compiled);

  return result;
};

function addStdFn(name: string, body: string) {
  const expression = new AssignExpression(name, new UnsafeExpression(body, stdLib), stdLib);

  statements.push(expression);
  stdLib.addName(name, expression);
}

// Not a standard lib fn, not accessible from the runtime
// TODO: protect this from being stomped on by user fns.
statements.push(new AssignExpression("__CHECK_RUNTIME", new UnsafeExpression("() => {__CHECK_RUNTIME.counter ++; if (__CHECK_RUNTIME.counter > 10_000) throw new Error('Maxiumum runtime exceeded'); return true; }", stdLib), stdLib))
statements.push(new UnsafeExpression("__CHECK_RUNTIME.counter = 0", stdLib))

statements.push(new AssignExpression("error", new UnsafeExpression("(message) => { throw new Error(message); }", stdLib), stdLib))

addStdFn("object","() => new Map()")
addStdFn("array","() => []")
addStdFn("set","(obj, key, value) => obj instanceof Map ? obj.set(key, value) : obj instanceof Array ? obj[Number(key)] = value : error('not a valid object')")
addStdFn("get","(obj, key) => obj instanceof Map ? obj.get(key) : obj instanceof Array ? obj[Number(key)] : error('not a valid object')")
addStdFn("push","(obj, value) => obj instanceof Array ? obj.push(value) : error('not a valid object')")
addStdFn("pop","(obj) => obj instanceof Array ? obj.pop() : error('not a valid object')")
addStdFn("multiply","(a, b) => a * b")
addStdFn("divide","(a, b) => a / b")
addStdFn("add","(a, b) => a + b")
addStdFn("subtract","(a, b) => a - b")
addStdFn("negate","(a) => - a")
addStdFn("not","(a) => ! a")
addStdFn("eq","(a, b) => a == b")
addStdFn("neq","(a, b) => a != b")
addStdFn("eqq","(a, b) => a === b")
addStdFn("gt","(a, b) => a > b")
addStdFn("lt","(a, b) => a < b")
addStdFn("gte","(a, b) => a >= b")
addStdFn("lte","(a, b) => a <= b")

// TODO: whole standard lib


console.log(exec(`

factorial = a>
  cond(
    eq(a, 1), 
    1, 
    multiply(
      a, 
      factorial(
        subtract(a, 1)
      )
    )
  )
  ;

gizard = a>b>add(a, b);
allow = person>eq(get(person, "name"),"joshua");
createPerson = name>{person = object(); setResult = set(person, "name", name); person};

add(
  add(
    "gizard(1)(2) = ",
    gizard(1)(2)
  ),
  add(
    add(
      "\\nallow(\\"joshua\\") = ",
      allow(createPerson("joshua"))
    ),
    add(
      "\\nfactorial(6)", 
      add(
        " = ", 
        factorial(6)
      )
    )
  )
)

`));
