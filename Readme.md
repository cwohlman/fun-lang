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
};

Manager = Person.{
  role = "Manager"
};

myNewManager = Manager.new("Big Boss");

```

```ts
class CustomObject {
  constructor() {}

  private fields = new Map();

  get();
  set();
}
```

```js
// Types

@toShape(person, Person);

foo[
  person |> @toShape(_, Person) |> @assert(_.name == "Joshua"),
] = {

}

```


### Safety
1. All functions must type their inputs
2. The type converstion/assertion ensures that all objects are of some type:
  - Map
  - Array
  - Object
  - Set
  - WeakMap, WeakSet, etc.
  - Custom
3. `name.key` maps to `name.key`, `name."key"` or `name.(key expression)` maps to `type.get(name, key)` and `name.key = value` maps to `type.set(name, key, value)`
4. If the type of an object is not known `name.key` is invalid syntax.
5. The built in types of Map, Array, Object, etc. must know how to safely get/set properties (e.g. there will be a list of disallowed properties)
  - Generally speaking the list of disallowed properties will be `prototype.getAllProperties()`
6. Types

### The API type
The api type only exposes the functions

