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
            await Post.create({ title: 'Published', slug: 'pub', type: 'news', published: true, project: testProject._id });
            await Post.create({ title: 'Draft', slug: 'draft', type: 'news', published: false, project: testProject._id });

            const res = await request(app).get('/api/v1/posts');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('Published');
        });

        it('should filter by type', async () => {
            await Post.create({ title: 'News', slug: 'n1', type: 'news', published: true, project: testProject._id });
            await Post.create({ title: 'Planting', slug: 'p1', type: 'pflanzung', published: true, project: testProject._id });

            const res = await request(app).get('/api/v1/posts?type=pflanzung');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('Planting');
        });

        it('should filter by project slug via resolveParams', async () => {
            const other = await Project.create({ name: 'Other', slug: 'other', active: true });
            await Post.create({ title: 'A', slug: 'a', type: 'news', published: true, project: testProject._id });
            await Post.create({ title: 'B', slug: 'b', type: 'news', published: true, project: other._id });

            const res = await request(app).get('/api/v1/posts?project=test-project');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].title).toBe('A');
        });
    });

    describe('GET /api/v1/posts/:slug', () => {
        it('should return post by slug', async () => {
            await Post.create({ title: 'My Post', slug: 'my-post', type: 'news', published: true, project: testProject._id, content: '<p>Content</p>' });

            const res = await request(app).get('/api/v1/posts/my-post');
            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('My Post');
        });

        it('should return 404 for unknown slug', async () => {
            const res = await request(app).get('/api/v1/posts/nonexistent');
            expect(res.statusCode).toBe(404);
        });
    });
});
