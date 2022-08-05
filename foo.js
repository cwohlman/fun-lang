(() => {
  const __CHECK_RUNTIME = () => {
    __CHECK_RUNTIME.counter++;
    if (__CHECK_RUNTIME.counter > 10_000)
      throw new Error("Maxiumum runtime exceeded");
    return true;
  };
  __CHECK_RUNTIME.counter = 0;
  const set = (obj, key, value) =>
    obj instanceof Map
      ? obj.set(key, value)
      : obj instanceof Array
      ? (obj[Number(key)] = value)
      : error("not a valid object");
  const get = (obj, key) =>
    obj instanceof Map
      ? obj.get(key)
      : obj instanceof Array
      ? obj[Number(key)]
      : error("not a valid object");
  const push = (obj, value) =>
    obj instanceof Array ? obj.push(value) : error("not a valid object");
  const pop = (obj) =>
    obj instanceof Array ? obj.pop() : error("not a valid object");
  const cond = (cond, ifTrue, ifFalse) => (cond ? ifTrue : ifFalse);
  const loop = (condition, body, accumulator) => {
    while (condition(accumulator)) {
      accumulator = body(accumulator);
    }
    return accumulator;
  };
  const multiply = (a, b) => a * b;
  const divide = (a, b) => a / b;
  const add = (a, b) => a + b;
  const subtract = (a, b) => console.log(a, b, a - b) || a - b;
  const negate = (a) => -a;
  const not = (a) => !a;
  const eq = (a, b) => a == b;
  const neq = (a, b) => a != b;
  const eqq = (a, b) => a === b;
  const gt = (a, b) => a > b;
  const lt = (a, b) => a < b;
  const gte = (a, b) => a >= b;
  const lte = (a, b) => a <= b;
  const factorial = (a) =>
    console.log(a) ||
    __CHECK_RUNTIME() &&
    cond(lte(a, 1), 1, multiply(a, factorial(subtract(a, 1))));
  return factorial(3);
})();
