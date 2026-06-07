import { describe, it, expect, beforeEach } from 'vitest';
import Order from '../../src/models/Order.js';
import Counter from '../../src/models/Counter.js';
import Project from '../../src/models/Project.js';

describe('Order Model', () => {
    beforeEach(async () => {
        await Project.create({ name: 'Test', slug: 'test', active: true });
    });

    it('should auto-generate a unique order number on save', async () => {
        const order = new Order({
            project: 'test',
            name: 'Test',
            email: 'test@test.com',
            street: 'St 1',
            zip: '12345',
            city: 'Town',
            quantity: 1,
            agb: true
        });
        await order.save();

        expect(order.orderNumber).toBeDefined();
        expect(order.orderNumber).toMatch(/^GPT-\d{4}-\d{4}$/);
    });

    it('should generate sequential order numbers', async () => {
        const baseData = {
            project: 'test',
            street: 'St 1',
            zip: '12345',
            city: 'Town',
            quantity: 1,
            agb: true
        };

        const order1 = await new Order({ ...baseData, name: 'A', email: 'a@test.com' }).save();
        const order2 = await new Order({ ...baseData, name: 'B', email: 'b@test.com' }).save();
        const order3 = await new Order({ ...baseData, name: 'C', email: 'c@test.com' }).save();

        const seq1 = parseInt(order1.orderNumber.split('-')[2]);
        const seq2 = parseInt(order2.orderNumber.split('-')[2]);
        const seq3 = parseInt(order3.orderNumber.split('-')[2]);

        expect(seq2).toBe(seq1 + 1);
        expect(seq3).toBe(seq2 + 1);
    });

    it('should store denormalized offering data', async () => {
        const order = new Order({
            project: 'test',
            offering: {
                slug: 'winterlinde',
                name: 'Winterlinde',
                category: 'Laubbaum',
                bezeichnungBotanisch: 'Tilia cordata'
            },
            name: 'Denorm Test',
            email: 'denorm@test.com',
            street: 'St 1',
            zip: '12345',
            city: 'Town',
            quantity: 1,
            agb: true
        });
        await order.save();

        const saved = await Order.findById(order._id);
        expect(saved.offering.slug).toBe('winterlinde');
        expect(saved.offering.name).toBe('Winterlinde');
        expect(saved.offering.category).toBe('Laubbaum');
        expect(saved.offering.bezeichnungBotanisch).toBe('Tilia cordata');
    });

    it('should generate unique order numbers under parallel saves', async () => {
        const baseData = {
            project: 'test',
            street: 'St 1',
            zip: '12345',
            city: 'Town',
            quantity: 1,
            agb: true
        };

        const promises = Array.from({ length: 10 }, (_, i) =>
            new Order({ ...baseData, name: `User ${i}`, email: `u${i}@test.com` }).save()
        );

        const orders = await Promise.all(promises);
        const numbers = orders.map(o => o.orderNumber);
        const uniqueNumbers = new Set(numbers);
        expect(uniqueNumbers.size).toBe(10);
    });

    it('should use atomic Counter collection with slug key', async () => {
        const order = new Order({
            project: 'test',
            name: 'Counter Check',
            email: 'counter@test.com',
            street: 'St 1',
            zip: '12345',
            city: 'Town',
            quantity: 1,
            agb: true
        });
        await order.save();

        const year = new Date().getFullYear();
        const counter = await Counter.findById(`order-test-${year}`);
        expect(counter).not.toBeNull();
        expect(counter.seq).toBeGreaterThanOrEqual(1);
    });
});
