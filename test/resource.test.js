import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Resource } from '../dist/index.js';

class UserResource extends Resource {
  constructor(user) {
    super();

    this.id = user.id;
    this.fullName = `${user.firstName} ${user.lastName}`;
  }
}

describe('Resource', () => {
  it('make() creates an instance of the concrete resource', () => {
    const result = UserResource.make({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    assert.ok(result instanceof UserResource);
    assert.equal(result.id, 1);
    assert.equal(result.fullName, 'Ada Lovelace');
  });

  it('collection() creates a separate resource for every value', () => {
    const result = UserResource.collection([
      { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
      { id: 2, firstName: 'Grace', lastName: 'Hopper' },
    ]);

    assert.equal(result.length, 2);
    assert.ok(result[0] instanceof UserResource);
    assert.ok(result[1] instanceof UserResource);
    assert.notStrictEqual(result[0], result[1]);
    assert.deepStrictEqual(
      result.map((user) => ({ id: user.id, fullName: user.fullName })),
      [
        { id: 1, fullName: 'Ada Lovelace' },
        { id: 2, fullName: 'Grace Hopper' },
      ],
    );
  });

  it('preserves concrete resource types for nested make()', () => {
    class CompanyResource extends Resource {
      constructor(company) {
        super();

        this.id = company.id;
        this.name = company.name;
      }
    }

    class EmployeeResource extends Resource {
      constructor(employee) {
        super();

        this.id = employee.id;
        this.company = CompanyResource.make(employee.company);
      }
    }

    const result = EmployeeResource.make({
      id: 1,
      company: { id: 10, name: 'Analytical Engines' },
    });

    assert.ok(result instanceof EmployeeResource);
    assert.ok(result.company instanceof CompanyResource);
    assert.equal(result.company.name, 'Analytical Engines');
  });

  it('preserves concrete resource types for nested collection()', () => {
    class ItemResource extends Resource {
      constructor(item) {
        super();

        this.sku = item.sku;
        this.quantity = item.quantity;
      }
    }

    class OrderResource extends Resource {
      constructor(order) {
        super();

        this.id = order.id;
        this.items = ItemResource.collection(order.items);
      }
    }

    const result = OrderResource.make({
      id: 42,
      items: [
        { sku: 'book', quantity: 1 },
        { sku: 'pen', quantity: 3 },
      ],
    });

    assert.ok(result instanceof OrderResource);
    assert.ok(result.items[0] instanceof ItemResource);
    assert.ok(result.items[1] instanceof ItemResource);
    assert.deepStrictEqual(
      result.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
      })),
      [
        { sku: 'book', quantity: 1 },
        { sku: 'pen', quantity: 3 },
      ],
    );
  });
});

describe('Resource pagination', () => {
  it('paginate() serializes the collection and calculates page metadata', () => {
    const result = UserResource.paginate(
      [
        { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
        { id: 2, firstName: 'Grace', lastName: 'Hopper' },
      ],
      { page: 2, limit: 2, total: 5 },
    );

    assert.deepStrictEqual(result.meta, {
      page: 2,
      limit: 2,
      total: 5,
      pages: 3,
    });
    assert.equal(result.data.length, 2);
    assert.ok(result.data[0] instanceof UserResource);
    assert.ok(result.data[1] instanceof UserResource);
    assert.equal('links' in result, false);
  });

  it('paginate() delegates resource creation to collection()', () => {
    let collectionCalls = 0;

    class TrackingUserResource extends UserResource {
      static collection(data) {
        collectionCalls += 1;
        return super.collection(data);
      }
    }

    const result = TrackingUserResource.paginate(
      [{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }],
      { page: 1, limit: 20, total: 1 },
    );

    assert.equal(collectionCalls, 1);
    assert.ok(result.data[0] instanceof TrackingUserResource);
  });

  it('paginate() handles an empty collection and total', () => {
    const result = UserResource.paginate([], {
      page: 1,
      limit: 20,
      total: 0,
    });

    assert.deepStrictEqual(result.meta, {
      page: 1,
      limit: 20,
      pages: 0,
      total: 0,
    });
  });
});

describe('Configured pagination', () => {
  it('supports global metadata, links, and endpoint metadata', () => {
    const ConfiguredResource = Resource.configure({
      pagination: {
        meta(state) {
          return {
            currentPage: state.page,
            pageSize: state.limit,
            totalItems: state.total,
            pageCount: state.pages,
          };
        },
        links(state) {
          return {
            first: '/users?page=1',
            prev: state.hasPreviousPage
              ? `/users?page=${state.page - 1}`
              : null,
            next: state.hasNextPage ? `/users?page=${state.page + 1}` : null,
          };
        },
      },
    });

    class ConfiguredUserResource extends ConfiguredResource {
      constructor(user) {
        super();

        this.id = user.id;
      }
    }

    const result = ConfiguredUserResource.paginate(
      [{ id: 1 }],
      { page: 2, limit: 1, total: 3 },
      { unreadCount: 7 },
    );

    assert.deepStrictEqual(result.meta, {
      currentPage: 2,
      pageSize: 1,
      totalItems: 3,
      pageCount: 3,
      unreadCount: 7,
    });
    assert.deepStrictEqual(result.links, {
      first: '/users?page=1',
      prev: '/users?page=1',
      next: '/users?page=3',
    });
    assert.ok(result.data[0] instanceof ConfiguredUserResource);
  });

  it('supports per-resource overrides without changing project config', () => {
    const ProjectResource = Resource.configure({
      pagination: {
        meta(state) {
          return {
            pageNumber: state.page,
            pageCount: state.pages,
          };
        },
        links(state) {
          return {
            next: state.hasNextPage ? `/orders?page=${state.page + 1}` : null,
          };
        },
      },
    });
    const LocalResource = ProjectResource.configurePagination({
      meta(state) {
        return {
          currentPage: state.page,
          pageCount: state.pages,
        };
      },
    });

    class LocalUserResource extends LocalResource {
      constructor(user) {
        super();

        this.id = user.id;
      }
    }

    class GlobalOrderResource extends ProjectResource {
      constructor(order) {
        super();

        this.id = order.id;
      }
    }

    const local = LocalUserResource.paginate([{ id: 1 }], {
      page: 2,
      limit: 1,
      total: 3,
    });
    const global = GlobalOrderResource.paginate([{ id: 1 }], {
      page: 2,
      limit: 1,
      total: 3,
    });

    assert.deepStrictEqual(local.meta, {
      currentPage: 2,
      pageCount: 3,
    });
    assert.deepStrictEqual(local.links, {
      next: '/orders?page=3',
    });
    assert.deepStrictEqual(global.meta, {
      pageNumber: 2,
      pageCount: 3,
    });
    assert.deepStrictEqual(global.links, {
      next: '/orders?page=3',
    });
  });

  it('passes a framework-agnostic context to links()', () => {
    let receivedContext;
    const ConfiguredResource = Resource.configure({
      pagination: {
        links(state, context) {
          receivedContext = context;

          return {
            next:
              context.path && state.hasNextPage
                ? `${context.path}?page=${state.page + 1}`
                : null,
          };
        },
      },
    });

    class ContextUserResource extends ConfiguredResource {
      constructor(user) {
        super();

        this.id = user.id;
      }
    }

    const result = ContextUserResource.paginate(
      [{ id: 1 }],
      { page: 1, limit: 1, total: 2 },
      undefined,
      {
        path: '/users',
        query: { status: 'active' },
        filter: { archived: false },
        sort: { field: 'createdAt' },
        search: 'Ada',
      },
    );

    assert.deepStrictEqual(receivedContext, {
      path: '/users',
      query: { status: 'active' },
      filter: { archived: false },
      sort: { field: 'createdAt' },
      search: 'Ada',
    });
    assert.deepStrictEqual(result.links, { next: '/users?page=2' });
  });

  it('can disable inherited links for one resource', () => {
    const ProjectResource = Resource.configure({
      pagination: {
        links() {
          return { next: '/projects?page=2' };
        },
      },
    });
    const NoLinksResource = ProjectResource.configurePagination({
      links: false,
    });

    class ProjectItemResource extends NoLinksResource {
      constructor(project) {
        super();

        this.id = project.id;
      }
    }

    const result = ProjectItemResource.paginate([{ id: 1 }], {
      page: 1,
      limit: 1,
      total: 1,
    });

    assert.equal('links' in result, false);
  });

  it('preserves nested resources inside paginated collections', () => {
    class ItemResource extends Resource {
      constructor(item) {
        super();

        this.sku = item.sku;
      }
    }

    class OrderResource extends Resource {
      constructor(order) {
        super();

        this.items = ItemResource.collection(order.items);
      }
    }

    const result = OrderResource.paginate([{ items: [{ sku: 'book' }] }], {
      page: 1,
      limit: 20,
      total: 1,
    });

    assert.ok(result.data[0].items[0] instanceof ItemResource);
    assert.equal(result.data[0].items[0].sku, 'book');
  });
});
