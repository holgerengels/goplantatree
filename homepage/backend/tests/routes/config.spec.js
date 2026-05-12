import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('Config API', () => {
    describe('GET /api/v1/config', () => {
        it('should return a list of config names', async () => {
            const res = await request(app).get('/api/v1/config');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body).toContain('order');
            expect(res.body).toContain('tree');
            expect(res.body).toContain('post');
        });
    });

    describe('GET /api/v1/config/entities', () => {
        it('should return entity metadata', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);

            // Should include known entities
            const slugs = res.body.map(e => e.slug);
            expect(slugs).toContain('bestellungen');
            expect(slugs).toContain('baeume');
            expect(slugs).toContain('post');
        });

        it('should include resource field', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            const order = res.body.find(e => e.entity === 'order');
            expect(order).toBeDefined();
            expect(order.resource).toBe('orders');
        });

        it('should include listPage field for trees', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            const tree = res.body.find(e => e.entity === 'tree');
            expect(tree).toBeDefined();
            expect(tree.listPage).toBe('/seite/baeume');
        });

        it('should be sorted by menuOrder', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            for (let i = 1; i < res.body.length; i++) {
                expect(res.body[i].menuOrder).toBeGreaterThanOrEqual(res.body[i - 1].menuOrder);
            }
        });

        it('should exclude project-specific configs (no slug)', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            // Project-specific configs like "100-baeume-bc-order" should not appear
            const entities = res.body.map(e => e.entity);
            // All entries should have entity and slug
            for (const entry of res.body) {
                expect(entry.entity).toBeDefined();
                expect(entry.slug).toBeDefined();
            }
        });
    });

    describe('GET /api/v1/config/:name', () => {
        it('should return a specific config', async () => {
            const res = await request(app).get('/api/v1/config/order');
            expect(res.statusCode).toBe(200);
            expect(res.body.entity).toBe('order');
            expect(res.body.fields).toBeDefined();
            expect(Array.isArray(res.body.fields)).toBe(true);
        });

        it('should return 404 for unknown config', async () => {
            const res = await request(app).get('/api/v1/config/nonexistent');
            expect(res.statusCode).toBe(404);
        });

        it('should return project-specific config', async () => {
            const res = await request(app).get('/api/v1/config/100-baeume-bc-order');
            expect(res.statusCode).toBe(200);
            expect(res.body.entity).toBe('order');
            expect(res.body.project).toBe('100-baeume-bc');
        });
    });
});
