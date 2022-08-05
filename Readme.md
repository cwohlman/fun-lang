# TODO
1. upgrade to pnpl
2. Built in support for many things:
  - parsers
  - regex
  - math
  - mutable/imutable transformation (the language should be imutable by default)
  - 
3. 


```js
myapi = {
  price = 100;

  buy = quantity -> quantity * - price;
  sell = quantity -> quantity * price;
}

sales = [
  myapi.buy(100),
  myapi.sell(20),
]

person = new {
  name = "john";
  $prop = value;
}

modifiedPerson = mutate person {
  name = "john smith";
  age = 22;
}

# myapi = { ...api, price: 200 }
newapi = mutate myapi { 
  price = 200;
}

foo[a,b] = a + b;
foo[a,b] : (number, number) => number;

$a = b // the variable with the name of the value a = value of b

@mutate // @ is reserved for compiler directives

$x // @dynamic(x)

@quote "{}" // AST of {}

Person = {
  new[name] = .{ 
    name = name
  };
  parse[input] = @toShape(input, Person)
  rename[newName] = .{
    name = newName
  };
}

```

```ts
class CustomObject {
  constructor() {}

  private fields = new Map();

  get();
  set();
}
```
