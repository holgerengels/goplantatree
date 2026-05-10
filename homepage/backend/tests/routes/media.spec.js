import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Media from '../../src/models/Media.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Media API', () => {
    beforeEach(async () => {
        await Media.deleteMany({});
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/media', () => {
        it('should allow reading media with valid token', async () => {
            const media = new Media({
                filename: 'test.jpg',
                originalName: 'test.jpg',
                url: '/api/v1/media/test/file',
                mimeType: 'image/jpeg',
                size: 1024,
                title: 'Test Image',
                data: Buffer.from('test')
            });
            await media.save();

            const token = generateToken({ media: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/media')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items.length).toBe(1);
            expect(res.body.items[0].title).toBe('Test Image');
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/v1/media');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/v1/media/:id/file', () => {
        it('should serve media file data', async () => {
            const media = new Media({
                filename: 'test2.jpg',
                originalName: 'test2.jpg',
                url: '/api/v1/media/test2/file',
                mimeType: 'image/png',
                size: 1024,
                data: Buffer.from('pngdata')
            });
            await media.save();

            const res = await request(app).get(`/api/v1/media/${media._id}/file`);
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('image/png');
            expect(res.body.toString()).toBe('pngdata');
        });

        it('should return 404 for non-existent file', async () => {
            const res = await request(app).get('/api/v1/media/000000000000000000000000/file');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /api/v1/media/:id', () => {
        it('should delete media with correct permissions', async () => {
            const media = new Media({
                filename: 'test.jpg',
                originalName: 'test.jpg',
                url: '/api/v1/media/test/file',
                mimeType: 'image/jpeg',
                size: 1024,
                title: 'Delete Image'
            });
            await media.save();

            const token = generateToken({ media: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/media/${media._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            const dbMedia = await Media.findById(media._id);
            expect(dbMedia).toBeNull();
        });
    });
});
