import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Media from '../../src/models/Media.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

const createMedia = (overrides = {}) => Media.create({
    filename: 'test.jpg', originalName: 'test.jpg', slug: 'test-media',
    mimeType: 'image/jpeg', size: 1024, url: '/api/v1/media/x/file',
    data: Buffer.from('fake-data'),
    ...overrides
});

describe('Media API — Server-side Search & Sort', () => {
    let token;

    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        token = generateToken({ media: { read: 'all' } });

        await createMedia({ slug: 'eiche-herbst', title: 'Eiche im Herbst', originalName: 'eiche_foto.jpg', author: 'Max Müller' });
        await createMedia({ slug: 'birke-fruehling', title: 'Birke im Frühling', originalName: 'birke.png', author: 'Anna Schmidt' });
        await createMedia({ slug: 'saeulen-amberbaum-4', title: 'Säulen-Amberbaum', originalName: 'amberbaum.jpg', author: 'Max Müller' });
        await createMedia({ slug: 'kornelkirsche', title: 'Kornelkirsche', originalName: 'kornelkirsche.jpg', author: 'Fritz König' });
        await createMedia({ slug: 'fichte-winter', title: 'Fichte im Winter', originalName: 'fichte_schnee.jpg', author: 'Anna Schmidt' });
    });

    describe('GET /api/v1/media?search= (search)', () => {
        it('should find media by title', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=Herbst')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].title).toBe('Eiche im Herbst');
        });

        it('should find media by slug', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=saeulen-amberbaum')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].slug).toBe('saeulen-amberbaum-4');
        });

        it('should find media by originalName', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=fichte_schnee')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].slug).toBe('fichte-winter');
        });

        it('should be case-insensitive', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=KORNELKIRSCHE')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
        });

        it('should return multiple matches', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=im')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            // "Eiche im Herbst", "Birke im Frühling", "Fichte im Winter"
            expect(res.body.items).toHaveLength(3);
        });

        it('should return empty for non-matching search', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=nonexistent-xyz')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(0);
        });

        it('should return total count matching search', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=im')
                .set('Authorization', `Bearer ${token}`);

            expect(res.body.total).toBe(3);
        });
    });

    describe('GET /api/v1/media?sort=&sortDir= (sort)', () => {
        it('should sort by title ascending', async () => {
            const res = await request(app)
                .get('/api/v1/media?sort=title&sortDir=asc')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            const titles = res.body.items.map(m => m.title);
            expect(titles).toEqual([
                'Birke im Frühling',
                'Eiche im Herbst',
                'Fichte im Winter',
                'Kornelkirsche',
                'Säulen-Amberbaum'
            ]);
        });

        it('should sort by title descending', async () => {
            const res = await request(app)
                .get('/api/v1/media?sort=title&sortDir=desc')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            const titles = res.body.items.map(m => m.title);
            expect(titles).toEqual([
                'Säulen-Amberbaum',
                'Kornelkirsche',
                'Fichte im Winter',
                'Eiche im Herbst',
                'Birke im Frühling'
            ]);
        });

        it('should sort by slug', async () => {
            const res = await request(app)
                .get('/api/v1/media?sort=slug&sortDir=asc')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            const slugs = res.body.items.map(m => m.slug);
            expect(slugs).toEqual([
                'birke-fruehling',
                'eiche-herbst',
                'fichte-winter',
                'kornelkirsche',
                'saeulen-amberbaum-4'
            ]);
        });

        it('should default to createdAt desc without sort param', async () => {
            const res = await request(app)
                .get('/api/v1/media')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(5);
            // Default sort is createdAt desc, last created first
            expect(res.body.items[0].slug).toBe('fichte-winter');
        });
    });

    describe('GET /api/v1/media?search=&sort= (combined)', () => {
        it('should search and sort results together', async () => {
            const res = await request(app)
                .get('/api/v1/media?search=im&sort=title&sortDir=asc')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(3);
            const titles = res.body.items.map(m => m.title);
            expect(titles).toEqual([
                'Birke im Frühling',
                'Eiche im Herbst',
                'Fichte im Winter'
            ]);
        });
    });
});
