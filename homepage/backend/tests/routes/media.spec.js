import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Media from '../../src/models/Media.js';
import Offering from '../../src/models/Offering.js';
import Tree from '../../src/models/Tree.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

// Helper: create valid Media document
const createMedia = (overrides = {}) => Media.create({
    filename: 'test.jpg', originalName: 'test.jpg', slug: 'test-media',
    mimeType: 'image/jpeg', size: 1024, url: '/api/v1/media/x/file',
    data: Buffer.from('fake-data'),
    ...overrides
});

describe('Media API (Soft Refs)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/media', () => {
        it('should list media with slug field', async () => {
            await createMedia({ slug: 'test-image', title: 'Test' });

            const token = generateToken({ media: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/media')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].slug).toBe('test-image');
        });
    });

    describe('GET /api/v1/media/by-slug/:slug/file', () => {
        it('should serve media file by slug', async () => {
            await createMedia({ slug: 'my-photo', mimeType: 'image/png' });

            const res = await request(app).get('/api/v1/media/by-slug/my-photo/file');
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('image/png');
        });

        it('should return 404 for unknown slug', async () => {
            const res = await request(app).get('/api/v1/media/by-slug/nonexistent/file');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /api/v1/media/by-slug/:slug/info', () => {
        it('should return media metadata by slug (without binary data)', async () => {
            await createMedia({ slug: 'info-image', title: 'My Title', author: 'Max' });

            const res = await request(app).get('/api/v1/media/by-slug/info-image/info');
            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('My Title');
            expect(res.body.author).toBe('Max');
            expect(res.body.slug).toBe('info-image');
            expect(res.body.data).toBeUndefined();
        });
    });

    describe('GET /api/v1/media/:id/file (backward compat)', () => {
        it('should still serve media by ObjectId', async () => {
            const media = await createMedia({ slug: 'compat' });
            const res = await request(app).get(`/api/v1/media/${media._id}/file`);
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('image/jpeg');
        });

        it('should serve variant if requested and available', async () => {
            const media = await createMedia({
                slug: 'variant-test',
                variants: {
                    thumb: {
                        data: Buffer.from('thumb-data'),
                        mimeType: 'image/webp',
                        width: 200,
                        height: 200,
                        size: 100
                    }
                }
            });

            const res = await request(app).get(`/api/v1/media/${media._id}/file?v=thumb`);
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('image/webp');
            expect(res.body.toString()).toBe('thumb-data');
        });

        it('should fallback to original if requested variant is missing', async () => {
            const media = await createMedia({ slug: 'no-variant' });
            
            const res = await request(app).get(`/api/v1/media/${media._id}/file?v=small`);
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('image/jpeg');
            expect(res.body.toString()).toBe('fake-data');
        });
    });

    describe('DELETE /api/v1/media/:id (Ref Integrity)', () => {
        it('should return 409 when media is referenced by offerings', async () => {
            const media = await createMedia({ slug: 'referenced-media' });
            await Offering.create({ name: 'O', slug: 'o', project: 'p', image: 'referenced-media', category: 'Laubbaum' });

            const token = generateToken({ media: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/media/${media._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('referenziert');
            expect(await Media.findById(media._id)).not.toBeNull();
        });

        it('should return 409 when media is referenced by trees', async () => {
            const media = await createMedia({ slug: 'tree-photo' });
            await Tree.create({ name: 'Eiche', slug: 'eiche', image: 'tree-photo' });

            const token = generateToken({ media: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/media/${media._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(409);
        });

        it('should allow force-delete of referenced media', async () => {
            const media = await createMedia({ slug: 'force-media' });
            await Offering.create({ name: 'O', slug: 'o', project: 'p', image: 'force-media', category: 'Laubbaum' });

            const token = generateToken({ media: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/media/${media._id}?force=true`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await Media.findById(media._id)).toBeNull();
        });

        it('should delete unreferenced media without issues', async () => {
            const media = await createMedia({ slug: 'free-media' });

            const token = generateToken({ media: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/media/${media._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
        });
    });
});
