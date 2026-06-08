import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Post from '../../src/models/Post.js';
import Project from '../../src/models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Posts API', () => {
    let testProject;

    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        testProject = await Project.create({ name: 'Test', slug: 'test-project', active: true });
    });

    describe('GET /api/v1/posts', () => {
        it('should allow public read of published posts', async () => {
            await Post.create({ title: 'Published', slug: 'pub', type: 'news', published: true, project: 'test-project' });
            await Post.create({ title: 'Draft', slug: 'draft', type: 'news', published: false, project: 'test-project' });

            const res = await request(app).get('/api/v1/posts');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('Published');
        });

        it('should filter by type', async () => {
            await Post.create({ title: 'News', slug: 'n1', type: 'news', published: true, project: 'test-project' });
            await Post.create({ title: 'Planting', slug: 'p1', type: 'pflanzung', published: true, project: 'test-project' });

            const res = await request(app).get('/api/v1/posts?type=pflanzung');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('Planting');
        });

        it('should filter by project slug directly', async () => {
            await Post.create({ title: 'A', slug: 'a', type: 'news', published: true, project: 'test-project' });
            await Post.create({ title: 'B', slug: 'b', type: 'news', published: true, project: 'other-project' });

            const res = await request(app).get('/api/v1/posts?project=test-project');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('A');
        });
    });

    describe('GET /api/v1/posts/:slug', () => {
        it('should return post by slug', async () => {
            await Post.create({ title: 'My Post', slug: 'my-post', type: 'news', published: true, project: 'test-project', content: '<p>Content</p>' });

            const res = await request(app).get('/api/v1/posts/my-post');
            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('My Post');
        });

        it('should return 404 for unknown slug', async () => {
            const res = await request(app).get('/api/v1/posts/nonexistent');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /api/v1/posts', () => {
        it('should bulk delete posts', async () => {
            const p1 = await Post.create({ title: 'Post 1', slug: 'p1', type: 'news', published: true, project: 'test-project' });
            const p2 = await Post.create({ title: 'Post 2', slug: 'p2', type: 'news', published: true, project: 'test-project' });

            const token = generateToken({ posts: { delete: 'all' } });

            const res = await request(app)
                .delete('/api/v1/posts')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids: [p1._id.toString(), p2._id.toString()] });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('2 Einträge gelöscht');

            // Verify they are deleted
            const remaining = await Post.find({ _id: { $in: [p1._id, p2._id] } });
            expect(remaining.length).toBe(0);
        });

        it('should respect own scope on bulk delete', async () => {
            const p1 = await Post.create({ title: 'Post 1', slug: 'p1', type: 'news', published: true, project: 'test-project' });
            const p2 = await Post.create({ title: 'Post 2', slug: 'p2', type: 'news', published: true, project: 'other-project' });

            const token = jwt.sign({ id: 'user123', project: 'test-project', permissions: { posts: { delete: 'own' } } }, JWT_SECRET);

            const res = await request(app)
                .delete('/api/v1/posts')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids: [p1._id.toString(), p2._id.toString()] });

            expect(res.statusCode).toBe(200);
            
            // Only 1 should be deleted (p1) because p2 belongs to another project
            const remaining = await Post.find({ _id: { $in: [p1._id, p2._id] } });
            expect(remaining.length).toBe(1);
            expect(remaining[0]._id.toString()).toBe(p2._id.toString());
        });
    });
});
