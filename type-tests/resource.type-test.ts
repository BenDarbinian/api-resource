import { Resource } from '../src/index.js';

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
        ? true
        : false;
type Expect<Value extends true> = Value;

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

const user = UserResource.make({
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
});
const users = UserResource.collection([
    { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
]);

type MakeReturnsConcreteResource = Expect<Equal<typeof user, UserResource>>;
type CollectionReturnsConcreteResources = Expect<
    Equal<typeof users, UserResource[]>
>;

// @ts-expect-error Resource.make() accepts the constructor input type.
UserResource.make({ id: '1', firstName: 'Ada', lastName: 'Lovelace' });
// @ts-expect-error Resource.collection() accepts constructor inputs.
UserResource.collection([{ id: '1', firstName: 'Ada', lastName: 'Lovelace' }]);

// @ts-expect-error Resource no longer accepts generic arguments.
class LegacyResource extends Resource<User> {}

type Company = { id: number; name: string };

class CompanyResource extends Resource {
    readonly id: number;
    readonly name: string;

    constructor(company: Company) {
        super();

        this.id = company.id;
        this.name = company.name;
    }
}

type Employee = { id: number; company: Company };

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

type NestedMakeReturnsNamedResource = Expect<
    Equal<typeof employee, EmployeeResource>
>;
type NestedResourceKeepsItsName = Expect<
    Equal<typeof employee.company, CompanyResource>
>;

type Item = { sku: string; quantity: number };

class ItemResource extends Resource {
    readonly sku: string;
    readonly quantity: number;

    constructor(item: Item) {
        super();

        this.sku = item.sku;
        this.quantity = item.quantity;
    }
}

type Order = { id: number; items: Item[] };

class OrderResource extends Resource {
    readonly id: number;
    readonly items: ItemResource[];

    constructor(order: Order) {
        super();

        this.id = order.id;
        this.items = ItemResource.collection(order.items);
    }
}

const order = OrderResource.make({
    id: 42,
    items: [{ sku: 'book', quantity: 1 }],
});

type NestedCollectionReturnsNamedResources = Expect<
    Equal<typeof order.items, ItemResource[]>
>;

const paginatedUsers = UserResource.paginate([
    { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
], {
    page: 2,
    limit: 20,
    total: 21,
});

type PaginatedDataKeepsConcreteResource = Expect<
    Equal<typeof paginatedUsers.data, UserResource[]>
>;
type DefaultPaginationPageIsNumber = Expect<
    Equal<typeof paginatedUsers.meta.page, number>
>;
type DefaultPaginationPagesIsNumber = Expect<
    Equal<typeof paginatedUsers.meta.pages, number>
>;

// @ts-expect-error Default pagination responses do not contain links.
paginatedUsers.links;

export type ResourceTypeTests =
    | MakeReturnsConcreteResource
    | CollectionReturnsConcreteResources
    | PaginatedDataKeepsConcreteResource
    | DefaultPaginationPageIsNumber
    | DefaultPaginationPagesIsNumber
    | NestedMakeReturnsNamedResource
    | NestedResourceKeepsItsName
    | NestedCollectionReturnsNamedResources;

const ConfiguredResource = Resource.configure({
    pagination: {
        meta(state) {
            return {
                currentPage: state.page,
                pageSize: state.limit,
                pageCount: state.pages,
            };
        },
        links(state) {
            return {
                next: state.hasNextPage ? '/users?page=2' : null,
            };
        },
    },
});

class ConfiguredUserResource extends ConfiguredResource {
    readonly id: number;

    constructor(user: User) {
        super();

        this.id = user.id;
    }
}

const configuredResult = ConfiguredUserResource.paginate(
    [{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }],
    { page: 1, limit: 20, total: 21 },
    { totalSum: 150_000 },
);

type ConfiguredDataKeepsConcreteResource = Expect<
    Equal<typeof configuredResult.data, ConfiguredUserResource[]>
>;
type ConfiguredCurrentPageIsNumber = Expect<
    Equal<typeof configuredResult.meta.currentPage, number>
>;
type ConfiguredExtraMetaIsNumber = Expect<
    Equal<typeof configuredResult.meta.totalSum, number>
>;
type ConfiguredNextLinkIsNullableString = Expect<
    Equal<typeof configuredResult.links.next, string | null>
>;

// @ts-expect-error Custom metadata replaces the default metadata shape.
configuredResult.meta.page;
ConfiguredUserResource.paginate(
    [{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }],
    { page: 1, limit: 20, total: 21 },
    // @ts-expect-error Extra metadata cannot overwrite pagination metadata.
    { pageCount: 1 },
);

const ProjectResource = Resource.configure({
    pagination: {
        meta(state) {
            return {
                pageNumber: state.page,
                pageCount: state.pages,
            };
        },
        links(state) {
            return { next: state.hasNextPage ? '/orders?page=2' : null };
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
    constructor(user: User) {
        super();
    }
}

class GlobalOrderResource extends ProjectResource {
    constructor(order: User) {
        super();
    }
}

const localResult = LocalUserResource.paginate(
    [{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }],
    { page: 1, limit: 20, total: 21 },
);
const globalResult = GlobalOrderResource.paginate(
    [{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }],
    { page: 1, limit: 20, total: 21 },
);

type LocalMetaIsInferred = Expect<
    Equal<typeof localResult.meta.currentPage, number>
>;
type GlobalMetaIsInferred = Expect<
    Equal<typeof globalResult.meta.pageNumber, number>
>;
// @ts-expect-error The local override does not leak into the project base.
localResult.meta.pageNumber;
// @ts-expect-error The project metadata does not leak into the local resource.
globalResult.meta.currentPage;
type LocalLinkIsInherited = Expect<
    Equal<typeof localResult.links.next, string | null>
>;
