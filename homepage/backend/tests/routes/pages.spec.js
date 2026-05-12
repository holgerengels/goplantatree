import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Page from '../../src/models/Page.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Pages API', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/pages', () => {
        it('should allow public read of published pages', async () => {
            await Page.create({ title: 'Public Page', slug: 'public', published: true, content: '<p>Hello</p>' });
            await Page.create({ title: 'Draft Page', slug: 'draft', published: false, content: '<p>Draft</p>' });

            const res = await request(app).get('/api/v1/pages');
            expect(res.statusCode).toBe(200);
            // Non-admin should only see published pages
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('Public Page');
        });

        it('should show all pages for admin users', async () => {
            await Page.create({ title: 'Public', slug: 'pub', published: true });
            await Page.create({ title: 'Draft', slug: 'drft', published: false });

            const token = generateToken({ pages: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/pages')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(2);
        });
    });

    describe('GET /api/v1/pages/:slug', () => {
        it('should return page by slug', async () => {
            await Page.create({ title: 'About Us', slug: 'ueber-uns', published: true, content: '<p>About</p>' });

            const res = await request(app).get('/api/v1/pages/ueber-uns');
            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('About Us');
            expect(res.body.content).toBe('<p>About</p>');
        });

        it('should return 404 for unknown slug', async () => {
            const res = await request(app).get('/api/v1/pages/nonexistent');
            expect(res.statusCode).toBe(404);
        });

        it('should still return unpublished page by direct slug (for admin preview)', async () => {
            await Page.create({ title: 'Secret', slug: 'secret', published: false });

            // Detail by slug does not filter by published — this is intentional
            // for admin preview. The list endpoint already filters.
            const res = await request(app).get('/api/v1/pages/secret');
            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('Secret');
        });
    });

    describe('POST /api/v1/pages', () => {
        it('should deny creation without auth', async () => {
            const res = await request(app)
                .post('/api/v1/pages')
                .send({ title: 'New Page', slug: 'new' });

            expect(res.statusCode).toBe(401);
        });

        it('should create page with valid permissions', async () => {
            const token = generateToken({ pages: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/pages')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Created Page', slug: 'created', content: '<p>New</p>' });

            expect(res.statusCode).toBe(201);
            expect(res.body.title).toBe('Created Page');
        });
    });
});
