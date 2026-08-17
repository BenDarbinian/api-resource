# @bendarbinian/api-resource

A lightweight, framework-agnostic library for transforming data into clean API resources, with first-class TypeScript support.

## Features

* Framework agnostic
* Works with JavaScript and TypeScript
* Automatic output type inference
* Optional explicit output types
* Single-resource transformation
* Collection transformation
* Nested resources
* Lightweight API with no framework-specific dependencies

## Installation

```bash
npm install @bendarbinian/api-resource
```

## Usage

```ts
import { Resource } from '@bendarbinian/api-resource';

type User = {
  id: number;
  firstName: string;
  lastName: string;
};

class UserResource extends Resource<User> {
  transform(user: User) {
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
    };
  }
}
```

### Transform a single resource

Use `make()` to transform a single value:

```ts
const user: User = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
};

const result = UserResource.make(user);
```

The output type is inferred automatically from `transform()`:

```ts
{
  id: number;
  fullName: string;
}
```

### Transform a collection

Use `collection()` to transform an array:

```ts
const users: User[] = [
  {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
  },
  {
    id: 2,
    firstName: 'Jane',
    lastName: 'Doe',
  },
];

const result = UserResource.collection(users);
```

The resulting type is inferred as an array of the `transform()` return type.

## Explicit Output Type

The output type can be specified explicitly when you want to enforce a response contract.

```ts
type UserResponse = {
  id: number;
  fullName: string;
};

class UserResource extends Resource<User, UserResponse> {
  transform(user: User): UserResponse {
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
    };
  }
}
```

If `transform()` returns a value that does not match `UserResponse`, TypeScript will report an error.

If the output type is omitted, it is inferred automatically from the concrete `transform()` implementation.

## Nested Resources

Resources can be composed to transform nested data.

```ts
type Company = {
  id: number;
  name: string;
};

type User = {
  id: number;
  firstName: string;
  lastName: string;
  company: Company;
};

class CompanyResource extends Resource<Company> {
  transform(company: Company) {
    return {
      id: company.id,
      name: company.name,
    };
  }
}

class UserResource extends Resource<User> {
  transform(user: User) {
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
      company: CompanyResource.make(user.company),
    };
  }
}
```

Collections can be nested in the same way:

```ts
class OrderResource extends Resource<Order> {
  transform(order: Order) {
    return {
      id: order.id,
      items: ItemResource.collection(order.items),
    };
  }
}
```

## API

### `Resource<Input, Output?>`

Base class for defining a resource transformation.

```ts
class UserResource extends Resource<User> {
  transform(user: User) {
    return {
      id: user.id,
    };
  }
}
```

`Input` defines the value accepted by `transform()`.

`Output` is optional. When omitted, the output of `make()` and `collection()` is inferred from the return type of the concrete `transform()` implementation.

### `Resource.make(data)`

Transforms a single value.

```ts
const result = UserResource.make(user);
```

### `Resource.collection(data)`

Transforms an array of values.

```ts
const result = UserResource.collection(users);
```

## License

MIT © 2026 Ben Darbinian
