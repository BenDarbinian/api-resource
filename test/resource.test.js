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
            result.map(user => ({ id: user.id, fullName: user.fullName })),
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
            result.items.map(item => ({
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
