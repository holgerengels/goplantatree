import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Order from '../../src/models/Order.js';
import Project from '../../src/models/Project.js';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Orders API', () => {
    let testProject;

    beforeEach(async () => {
        await Order.deleteMany({});
        await Project.deleteMany({});
        process.env.JWT_SECRET = JWT_SECRET;
        
        testProject = new Project({ name: 'Test Project', slug: 'test-project', active: true });
        await testProject.save();
    });

    describe('POST /api/v1/orders', () => {
        it('should fail validation if required fields are missing', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: testProject._id
                    // Missing name, email, etc.
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Name ist ein Pflichtfeld');
            expect(res.body.error).toContain('E-Mail ist ein Pflichtfeld');
        });

        it('should create an order successfully when all required fields are present', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: testProject._id,
                    name: 'John Doe',
                    email: 'john@example.com',
                    street: 'Musterstraße 1',
                    zip: '12345',
                    city: 'Musterstadt',
                    quantity: 2,
                    agb: true
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.orderNumber).toBeDefined();
            expect(res.body.message).toBe('Bestellung erfolgreich aufgegeben');

            const order = await Order.findOne({ email: 'john@example.com' });
            expect(order).not.toBeNull();
            expect(order.name).toBe('John Doe');
            expect(order.quantity).toBe(2);
        });
    });

    describe('GET /api/v1/orders', () => {
        beforeEach(async () => {
            const order = new Order({
                project: testProject._id,
                name: 'Jane Doe',
                email: 'jane@example.com',
                street: 'Test 1',
                zip: '00000',
                city: 'Testcity',
                quantity: 1,
                agb: true
            });
            await order.save();
        });

        it('should deny access without a token', async () => {
            const res = await request(app).get('/api/v1/orders');
            expect(res.statusCode).toBe(401);
        });

        it('should allow access with read permission', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.orders.length).toBe(1);
            expect(res.body.orders[0].name).toBe('Jane Doe');
            expect(res.body.total).toBe(1);
        });
    });

    describe('DELETE /api/v1/orders/:id', () => {
        let order;
        beforeEach(async () => {
            order = new Order({
                project: testProject._id,
                name: 'Delete Me',
                email: 'del@example.com',
                street: 'Test 1',
                zip: '00000',
                city: 'Testcity',
                quantity: 1,
                agb: true
            });
            await order.save();
        });

        it('should deny deletion without correct permissions', async () => {
            const token = generateToken({ orders: { read: 'all' } }); // Missing delete
            const res = await request(app)
                .delete(`/api/v1/orders/${order._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(403);
            const dbOrder = await Order.findById(order._id);
            expect(dbOrder).not.toBeNull();
        });

        it('should delete order with valid permissions', async () => {
            const token = generateToken({ orders: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/orders/${order._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Bestellung gelöscht');

            const dbOrder = await Order.findById(order._id);
            expect(dbOrder).toBeNull();
        });
    });
});
