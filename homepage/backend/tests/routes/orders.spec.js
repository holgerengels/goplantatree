import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Order from '../../src/models/Order.js';
import Offering from '../../src/models/Offering.js';
import Project from '../../src/models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Orders API (Soft Refs + Denormalization)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        await Project.create({ name: 'Test Project', slug: 'test-project', active: true });
        await Offering.create({
            name: 'Winterlinde', slug: 'winterlinde',
            project: 'test-project', category: 'Laubbaum',
            bezeichnungBotanisch: 'Tilia cordata', available: true
        });
    });

    describe('POST /api/v1/orders (public, with offering denormalization)', () => {
        it('should create an order with project slug', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Max Mustermann',
                    email: 'max@example.com',
                    street: 'Musterstraße 1',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.orderNumber).toBeDefined();

            // Verify denormalized offering data in DB
            const order = await Order.findOne({ email: 'max@example.com' });
            expect(order).not.toBeNull();
            expect(order.project).toBe('test-project');
            expect(order.offering.slug).toBe('winterlinde');
            expect(order.offering.name).toBe('Winterlinde');
            expect(order.offering.category).toBe('Laubbaum');
            expect(order.offering.bezeichnungBotanisch).toBe('Tilia cordata');
        });

        it('should denormalize offering as snapshot (changing offering should NOT affect order)', async () => {
            // Create order
            await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Anna Snapshot',
                    email: 'anna@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            // Now change the offering name
            await Offering.findOneAndUpdate(
                { slug: 'winterlinde' },
                { name: 'Winterlinde UPDATED' }
            );

            // Order should still have the OLD name
            const order = await Order.findOne({ email: 'anna@test.de' });
            expect(order.offering.name).toBe('Winterlinde');
        });

        it('should handle non-existent offering slug gracefully', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'does-not-exist',
                    name: 'Ghost Order',
                    email: 'ghost@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            expect(res.statusCode).toBe(201);

            // Order should be created with a fallback offering
            const order = await Order.findOne({ email: 'ghost@test.de' });
            expect(order.offering.slug).toBe('does-not-exist');
            expect(order.offering.name).toBe('does-not-exist');
        });

        it('should create order without offering', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    name: 'No Offering',
                    email: 'no-offer@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            expect(res.statusCode).toBe(201);
        });

        it('should fail validation for missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({ project: 'test-project' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Name ist ein Pflichtfeld');
        });
    });

    describe('GET /api/v1/orders (admin, slug filter)', () => {
        beforeEach(async () => {
            await Order.create({
                project: 'test-project',
                offering: { slug: 'winterlinde', name: 'Winterlinde', category: 'Laubbaum', bezeichnungBotanisch: 'Tilia cordata' },
                name: 'List Test', email: 'list@test.de',
                street: 'Str 1', zip: '12345', city: 'Stadt',
                quantity: 1, agb: true
            });
        });

        it('should deny access without token', async () => {
            const res = await request(app).get('/api/v1/orders');
            expect(res.statusCode).toBe(401);
        });

        it('should list orders with denormalized offering data', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].project).toBe('test-project');
            expect(res.body.items[0].offering.slug).toBe('winterlinde');
            expect(res.body.items[0].offering.name).toBe('Winterlinde');
        });

        it('should filter orders by project slug', async () => {
            await Order.create({
                project: 'other-project',
                orderNumber: 'GPT-2026-9999',
                name: 'Other', email: 'other@test.de',
                street: 'Str 2', zip: '54321', city: 'Anderswo',
                quantity: 1, agb: true
            });

            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders?project=test-project')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].project).toBe('test-project');
        });

        it('should deny export without token', async () => {
            const res = await request(app).get('/api/v1/orders/export');
            expect(res.statusCode).toBe(401);
        });

        it('should export orders as CSV with correct columns and data', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=csv')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.header['content-type']).toContain('text/csv');
            expect(res.header['content-disposition']).toContain('attachment; filename=orders_export.csv');
            
            // Should start with UTF-8 BOM \uFEFF
            expect(res.text.startsWith('\uFEFF')).toBe(true);
            
            // Header should contain fields configured in order.json's exportColumns
            expect(res.text).toContain('Nr.;Projekt;Name;E-Mail;Telefon;Straße;PLZ;Stadt;Baum;Anzahl;Zusatzoptionen;Pflanzort;Anmerkungen;Status;Datum');
            expect(res.text).toContain('List Test;list@test.de');
        });

        it('should export orders as ODS', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=ods')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.header['content-type']).toContain('application/vnd.oasis.opendocument.spreadsheet');
            expect(res.header['content-disposition']).toContain('attachment; filename=orders_export.ods');
            expect(res.body).toBeDefined();
        });

        it('should filter export by search query', async () => {
            await Order.create({
                project: 'test-project',
                orderNumber: 'GPT-2026-9999',
                name: 'Other Name', email: 'other@test.de',
                street: 'Str 2', zip: '54321', city: 'Anderswo',
                quantity: 1, agb: true
            });

            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=csv&search=Other')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Other Name');
            expect(res.text).not.toContain('List Test');
        });
    });
});
