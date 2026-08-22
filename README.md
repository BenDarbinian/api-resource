# @bendarbinian/api-resource

A small, framework-agnostic library for turning domain data into typed API
resources. Define the public response fields in a class constructor, then use
the same class for single values, collections, nested resources, and paginated
responses.

## Features

- Constructor-driven resources with no separate transform contract
- Concrete return types inferred from each resource class
- Single resources, collections, and nested resources
- Typed paginated responses with customizable metadata and links
- Project-wide pagination defaults with per-resource overrides
- JavaScript and TypeScript support
- ESM-only package with no runtime dependencies

## Requirements

- Node.js 20 or newer
- An ESM project or an environment that can import ESM packages

## Installation

```bash
npm install @bendarbinian/api-resource
```

## Quick start

Extend `Resource` and let the constructor describe both the accepted domain
value and the public response shape:

```ts
import { Resource } from '@bendarbinian/api-resource';

type User = {
  id: number;
  firstName: string;
  lastName: string;
  passwordHash: string;
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

const user = UserResource.make({
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  passwordHash: 'not-exposed',
});
// UserResource { id: 1, fullName: 'Ada Lovelace' }

const users = UserResource.collection([
  {
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'not-exposed',
  },
  {
    id: 2,
    firstName: 'Grace',
    lastName: 'Hopper',
    passwordHash: 'not-exposed',
  },
]);
// UserResource[]
```

`make()` and `collection()` infer the constructor input and preserve the
concrete resource type. Each collection item is a separate resource instance,
in the same order as the input data.

## Nested resources

Compose resources by calling `make()` or `collection()` inside another
resource constructor. Nested values keep their concrete resource types:

```ts
type Company = {
  id: number;
  name: string;
};

type Employee = {
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

class EmployeeResource extends Resource {
  readonly id: number;
  readonly company: CompanyResource;

  constructor(employee: Employee) {
    super();

    this.id = employee.id;
    this.company = CompanyResource.make(employee.company);
  }
}

const employee = EmployeeResource.make({
  id: 1,
  company: { id: 10, name: 'Analytical Engines' },
});

employee.company instanceof CompanyResource;
// true
```

Use `SomeResource.collection(data)` in the same way for nested arrays.

## Pagination

### Default response

`paginate()` creates the resource collection and calculates the default
metadata:

```ts
const result = UserResource.paginate(
  usersFromDatabase,
  { page: 2, limit: 20, total: 42 },
  { unreadCount: 3 },
);

result.data;
// UserResource[]

result.meta;
// {
//   page: 2,
//   limit: 20,
//   total: 42,
//   pages: 3,
//   unreadCount: 3,
// }
```

The optional third argument adds endpoint-specific metadata. In TypeScript,
its keys cannot overwrite keys returned by the configured metadata factory.

By default, the response has no `links` property. The library calculates
`pages` as `Math.ceil(total / limit)` and expects the caller or framework
adapter to provide valid pagination values; it does not validate or clamp
`page`, `limit`, or `total`.

### Custom metadata and links

Use `Resource.configure()` once to create a project base class. Metadata and
link return types are inferred automatically:

```ts
const ApiResource = Resource.configure({
  pagination: {
    meta(state) {
      return {
        currentPage: state.page,
        pageSize: state.limit,
        totalItems: state.total,
        pageCount: state.pages,
      };
    },
    links(state, context) {
      const path = context.path ?? '/users';

      return {
        first: `${path}?page=1`,
        previous: state.hasPreviousPage
          ? `${path}?page=${state.page - 1}`
          : null,
        next: state.hasNextPage ? `${path}?page=${state.page + 1}` : null,
      };
    },
  },
});

class ApiUserResource extends ApiResource {
  readonly id: number;

  constructor(user: User) {
    super();
    this.id = user.id;
  }
}

const result = ApiUserResource.paginate(
  usersFromDatabase,
  { page: 2, limit: 20, total: 42 },
  { unreadCount: 3 },
  { path: '/users', search: 'Ada' },
);

result.meta.currentPage;
// number

result.links.next;
// string | null
```

The metadata factory replaces the default metadata shape. Both factories
receive a `PaginationState` with `page`, `limit`, `total`, `pages`,
`hasPreviousPage`, and `hasNextPage`.

The link factory also receives an optional `PaginationLinkContext`. Its
built-in fields are `path`, `query`, `filter`, `sort`, and `search`; custom
fields are allowed for framework adapters. If no context is passed,
`links()` receives an empty object.

### Per-resource overrides

Use `configurePagination()` to derive a base class with local settings.
Unspecified settings are inherited:

```ts
const AdminResource = ApiResource.configurePagination({
  meta(state) {
    return {
      currentPage: state.page,
      pageCount: state.pages,
    };
  },
});

const ResourceWithoutLinks = ApiResource.configurePagination({
  links: false,
});
```

`AdminResource` keeps the project link factory and replaces only its metadata
factory. `ResourceWithoutLinks` omits `links` from both runtime responses and
their inferred TypeScript type.

## API reference

### `Resource.make(data)`

Calls the concrete resource constructor once and returns its instance.

### `Resource.collection(data)`

Calls the concrete resource constructor once per input value and returns the
instances in input order.

### `Resource.paginate(data, pagination, extraMeta?, context?)`

Returns `{ data, meta }` and includes `links` when a link factory is
configured. `data` preserves the concrete resource type.

### `Resource.configure({ pagination })`

Creates a typed base class with project-wide `meta` and `links` factories.

### `Resource.configurePagination(configuration)`

Creates a typed base class that overrides selected pagination settings while
inheriting the rest.

## Exported types

The package exports the following TypeScript types from its root entry point:

- `PaginationInput` — caller-provided `page`, `limit`, and `total`
- `PaginationState` — pagination input plus derived page state
- `DefaultPaginationMeta` — default response metadata shape
- `PaginationMetaFactory<Meta>` — custom metadata callback
- `PaginationLinkContext` — framework-agnostic link context
- `PaginationLinksFactory<Links>` — custom links callback
- `PaginationConfig<Meta, Links>` — pagination configuration object
- `PaginatedResponse<Resource, Meta, Links, ExtraMeta>` — response shape

## License

MIT © 2026 Ben Darbinian
