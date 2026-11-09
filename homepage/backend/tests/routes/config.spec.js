import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { clearConfigCache } from '../../src/routes/config.js';

describe('Config API', () => {
    beforeEach(() => {
        clearConfigCache();
    });

    describe('GET /api/v1/config', () => {
        it('should return list of config names', async () => {
            const res = await request(app).get('/api/v1/config');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toContain('tree');
            expect(res.body).toContain('order');
            expect(res.body).toContain('post');
            expect(res.body).toContain('page');
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
            expect(slugs).toContain('blog');
        });

        it('should include resource field', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            const order = res.body.find(e => e.entity === 'order');
            expect(order).toBeDefined();
            expect(order.resource).toBe('orders');
        });

        it('should be sorted by menuOrder', async () => {
            const res = await request(app).get('/api/v1/config/entities');
            for (let i = 1; i < res.body.length; i++) {
                expect(res.body[i].menuOrder).toBeGreaterThanOrEqual(res.body[i - 1].menuOrder);
            }
        });
    });

    describe('GET /api/v1/config/:name', () => {
        it('should return a specific config', async () => {
            const res = await request(app).get('/api/v1/config/tree');
            expect(res.statusCode).toBe(200);
            expect(res.body.entity).toBe('tree');
            expect(res.body.label).toBeDefined();
            expect(res.body.fields).toBeDefined();
        });

        it('should return 404 for unknown config', async () => {
            const res = await request(app).get('/api/v1/config/nonexistent');
            expect(res.statusCode).toBe(404);
            expect(res.body.error).toContain('nicht gefunden');
        });
    });
});
