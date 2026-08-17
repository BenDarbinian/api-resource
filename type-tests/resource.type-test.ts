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

class UserResource extends Resource<User> {
    transform(user: User) {
        return {
            id: user.id,
            fullName: `${user.firstName} ${user.lastName}`,
        };
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

type UserOutput = { id: number; fullName: string };
type MakeOutputInference = Expect<Equal<typeof user, UserOutput>>;
type CollectionOutputInference = Expect<Equal<typeof users, UserOutput[]>>;

// @ts-expect-error Resource.make() accepts the transform input type.
UserResource.make({ id: '1', firstName: 'Ada', lastName: 'Lovelace' });
// @ts-expect-error Resource.collection() accepts an array of transform inputs.
UserResource.collection([{ id: '1', firstName: 'Ada', lastName: 'Lovelace' }]);

type ExplicitUserOutput = {
    id: number;
    displayName: string;
};

class ExplicitUserResource extends Resource<User, ExplicitUserOutput> {
    transform(user: User): ExplicitUserOutput {
        return {
            id: user.id,
            displayName: `${user.lastName}, ${user.firstName}`,
        };
    }
}

const explicitUser = ExplicitUserResource.make({
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
});

type ExplicitOutputContract = Expect<
    Equal<typeof explicitUser, ExplicitUserOutput>
>;

class InvalidExplicitUserResource extends Resource<User, ExplicitUserOutput> {
    // @ts-expect-error The transform result must satisfy the explicit Output contract.
    transform(user: User) {
        return {
            id: String(user.id),
            displayName: `${user.lastName}, ${user.firstName}`,
        };
    }
}

type Company = { id: number; name: string };

class CompanyResource extends Resource<Company> {
    transform(company: Company) {
        return { id: company.id, name: company.name };
    }
}

type Employee = { id: number; company: Company };

class EmployeeResource extends Resource<Employee> {
    transform(employee: Employee) {
        return {
            id: employee.id,
            company: CompanyResource.make(employee.company),
        };
    }
}

const employee = EmployeeResource.make({
    id: 1,
    company: { id: 10, name: 'Analytical Engines' },
});

type NestedMakeOutput = Expect<
    Equal<
        typeof employee,
        { id: number; company: { id: number; name: string } }
    >
>;

type Item = { sku: string; quantity: number };

class ItemResource extends Resource<Item> {
    transform(item: Item) {
        return { sku: item.sku, quantity: item.quantity };
    }
}

type Order = { id: number; items: Item[] };

class OrderResource extends Resource<Order> {
    transform(order: Order) {
        return {
            id: order.id,
            items: ItemResource.collection(order.items),
        };
    }
}

const order = OrderResource.make({
    id: 42,
    items: [{ sku: 'book', quantity: 1 }],
});

type NestedCollectionOutput = Expect<
    Equal<
        typeof order,
        { id: number; items: { sku: string; quantity: number }[] }
    >
>;

export type ResourceTypeTests =
    | MakeOutputInference
    | CollectionOutputInference
    | ExplicitOutputContract
    | NestedMakeOutput
    | NestedCollectionOutput;
