import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Resource } from '../dist/index.js';

class UserResource extends Resource {
    transform(user) {
        return {
            id: user.id,
            fullName: `${user.firstName} ${user.lastName}`,
        };
    }
}

describe('Resource', () => {
    it('make() transforms one value', () => {
        const result = UserResource.make({
            id: 1,
            firstName: 'Ada',
            lastName: 'Lovelace',
        });

        assert.deepStrictEqual(result, {
            id: 1,
            fullName: 'Ada Lovelace',
        });
    });

    it('collection() transforms every value and preserves order', () => {
        const result = UserResource.collection([
            { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
            { id: 2, firstName: 'Grace', lastName: 'Hopper' },
        ]);

        assert.deepStrictEqual(result, [
            { id: 1, fullName: 'Ada Lovelace' },
            { id: 2, fullName: 'Grace Hopper' },
        ]);
    });

    it('supports nested Resource.make()', () => {
        class CompanyResource extends Resource {
            transform(company) {
                return { id: company.id, name: company.name };
            }
        }

        class EmployeeResource extends Resource {
            transform(employee) {
                return {
                    id: employee.id,
                    company: CompanyResource.make(employee.company),
                };
            }
        }

        const result = EmployeeResource.make({
            id: 1,
            company: { id: 10, name: 'Analytical Engines' },
        });

        assert.deepStrictEqual(result, {
            id: 1,
            company: { id: 10, name: 'Analytical Engines' },
        });
    });

    it('supports nested Resource.collection()', () => {
        class ItemResource extends Resource {
            transform(item) {
                return { sku: item.sku, quantity: item.quantity };
            }
        }

        class OrderResource extends Resource {
            transform(order) {
                return {
                    id: order.id,
                    items: ItemResource.collection(order.items),
                };
            }
        }

        const result = OrderResource.make({
            id: 42,
            items: [
                { sku: 'book', quantity: 1 },
                { sku: 'pen', quantity: 3 },
            ],
        });

        assert.deepStrictEqual(result, {
            id: 42,
            items: [
                { sku: 'book', quantity: 1 },
                { sku: 'pen', quantity: 3 },
            ],
        });
    });
});
