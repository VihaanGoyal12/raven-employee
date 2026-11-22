import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscountLocal } from '../srv/sales-service.js';

test('Discount Calculation Rules & Boundary Testing', async (t) => {
    await t.test('Premium Customer - Greater than 10,000 gives 15%', () => {
        assert.equal(calculateDiscountLocal('Premium', 10001.00), 15.0);
        assert.equal(calculateDiscountLocal('Premium', 50000.00), 15.0);
        assert.equal(calculateDiscountLocal('Premium', 12400.00), 15.0);
    });

    await t.test('Premium Customer - Boundary: exactly 10,000 gives 10% (not > 10000)', () => {
        assert.equal(calculateDiscountLocal('Premium', 10000.00), 10.0);
    });

    await t.test('Premium Customer - Between 5,000 and 10,000 gives 10%', () => {
        assert.equal(calculateDiscountLocal('Premium', 7000.00), 10.0);
        assert.equal(calculateDiscountLocal('Premium', 6000.00), 10.0);
        assert.equal(calculateDiscountLocal('Premium', 5001.00), 10.0);
    });

    await t.test('Premium Customer - Boundary: exactly 5,000 gives 0% (not > 5000)', () => {
        assert.equal(calculateDiscountLocal('Premium', 5000.00), 0.0);
        assert.equal(calculateDiscountLocal('Premium', 4300.00), 0.0);
    });

    await t.test('Regular Customer - Greater than 5,000 gives 5%', () => {
        assert.equal(calculateDiscountLocal('Regular', 5001.00), 5.0);
        assert.equal(calculateDiscountLocal('Regular', 10000.00), 5.0);
    });

    await t.test('Regular Customer - Boundary: exactly 5,000 gives 0%', () => {
        assert.equal(calculateDiscountLocal('Regular', 5000.00), 0.0);
        assert.equal(calculateDiscountLocal('Regular', 2150.00), 0.0);
    });

    await t.test('Unknown / Other Customer Types give 0%', () => {
        assert.equal(calculateDiscountLocal('Corporate', 50000.00), 0.0);
        assert.equal(calculateDiscountLocal('', 50000.00), 0.0);
        assert.equal(calculateDiscountLocal(null, 50000.00), 0.0);
    });
});
