# @bendarbinian/api-resource

A lightweight library for building typed API resources from domain data, with first-class TypeScript support.

## Features

* Framework agnostic
* Works with JavaScript and TypeScript
* Concrete, named resource types
* Single-resource creation
* Collection creation
* Nested resources
* One resource instance per input value
* Lightweight API with no framework-specific dependencies

## Installation

```bash
npm install @bendarbinian/api-resource
```

## Usage

Define the public fields of a resource and initialize them from domain data in its constructor:

```ts
import { Resource } from '@bendarbinian/api-resource';

type User = {
  id: number;
  firstName: string;
  lastName: string;
};

class UserResource extends Resource {
  readonly id: number;
  readonly fullName: string;

  constructor(user: User) {
    super();

    this.id = user.id;
    this.fullName = `${user.firstName} ${user.lastName}`;
  }
}
```

### Create a single resource

Use `make()` to create a concrete resource instance:

```ts
const user: User = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
};

const result = UserResource.make(user);
// UserResource

result instanceof UserResource;
// true
```

The constructor input type is enforced, and the result type is the concrete resource class.

### Create a collection

Use `collection()` to create one resource instance per input value:

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
// UserResource[]
```

## Nested resources

Resources keep their named types when they are composed:

```ts
type Company = {
  id: number;
  name: string;
};

type User = {
  id: number;
  company: Company;
};

class CompanyResource extends Resource {
  readonly id: number;
  readonly name: string;

  constructor(company: Company) {
    super();

    this.id = company.id;
    this.name = company.name;
  }
}

class UserResource extends Resource {
  readonly id: number;
  readonly company: CompanyResource;

  constructor(user: User) {
    super();

    this.id = user.id;
    this.company = CompanyResource.make(user.company);
  }
}

const user = UserResource.make({
  id: 1,
  company: { id: 10, name: 'Acme' },
});

user.company;
// CompanyResource
```

Collections can be nested in the same way:

```ts
class OrderResource extends Resource {
  readonly id: number;
  readonly items: ItemResource[];

  constructor(order: Order) {
    super();

    this.id = order.id;
    this.items = ItemResource.collection(order.items);
  }
}
```

## API

### `Resource`

Base class for a typed API resource. The first parameter of the concrete resource constructor defines the domain data accepted by `make()` and `collection()`.

Resource fields and their output types are declared directly on the concrete class. There is no separate output generic and no `transform()` contract.

### `Resource.make(data)`

Calls the concrete resource constructor and returns its instance:

```ts
const result = UserResource.make(user);
// UserResource
```

### `Resource.collection(data)`

Calls the concrete resource constructor once for every input value and returns the instances in the same order:

```ts
const result = UserResource.collection(users);
// UserResource[]
```

## Roadmap

* Pagination
* Metadata
* Conditional fields
* Context
* Async creation
* Framework integrations
  * NestJS
  * Express
  * Swagger

## License

MIT © 2026 Ben Darbinian
