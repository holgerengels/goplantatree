import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Project from '../../src/models/Project.js';
import Offering from '../../src/models/Offering.js';
import Post from '../../src/models/Post.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Projects API (Soft Refs)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/projects', () => {
        it('should allow public read access', async () => {
            await Project.create({ name: 'Public Project', slug: 'public', active: true });
            const res = await request(app).get('/api/v1/projects');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Public Project');
        });

        it('should return 404 for unknown slug', async () => {
            const res = await request(app).get('/api/v1/projects/unknown-slug');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/projects', () => {
        it('should deny creation without token', async () => {
            const res = await request(app)
                .post('/api/v1/projects')
                .send({ name: 'New Project', slug: 'new' });
            expect(res.statusCode).toBe(401);
        });

        it('should create project with valid permissions', async () => {
            const token = generateToken({ projects: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/projects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Valid Project', slug: 'valid' });

            expect(res.statusCode).toBe(201);
            expect(res.body.slug).toBe('valid');
        });
    });

    describe('PUT /api/v1/projects/:id (Slug Cascade)', () => {
        it('should cascade update all references when slug changes', async () => {
            const project = await Project.create({ name: 'Old Name', slug: 'old-slug', active: true });

            // Create referencing documents
            await Offering.create({ name: 'O1', slug: 'o1', project: 'old-slug', category: 'Laubbaum' });
            await Offering.create({ name: 'O2', slug: 'o2', project: 'old-slug', category: 'Obstbaum' });
            await Post.create({ title: 'P1', slug: 'p1', project: 'old-slug' });

            const token = generateToken({ projects: { update: 'all' } });
            const res = await request(app)
                .put(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Name', slug: 'new-slug' });

            expect(res.statusCode).toBe(200);
            expect(res.body.slug).toBe('new-slug');
            expect(res.body._cascade).toBeDefined();
            expect(res.body._cascade.totalUpdated).toBe(3);

            // Verify all references updated
            expect(await Offering.find({ project: 'new-slug' })).toHaveLength(2);
            expect(await Post.find({ project: 'new-slug' })).toHaveLength(1);
            expect(await Offering.find({ project: 'old-slug' })).toHaveLength(0);
        });

        it('should NOT cascade when slug does not change', async () => {
            const project = await Project.create({ name: 'Same', slug: 'same-slug', active: true });
            await Offering.create({ name: 'O1', slug: 'o1', project: 'same-slug', category: 'Laubbaum' });

            const token = generateToken({ projects: { update: 'all' } });
            const res = await request(app)
                .put(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated Name', slug: 'same-slug' });

            expect(res.statusCode).toBe(200);
            expect(res.body._cascade).toBeUndefined(); // No cascade needed
        });
    });

    describe('DELETE /api/v1/projects/:id (Ref Integrity)', () => {
        it('should return 409 when project is still referenced', async () => {
            const project = await Project.create({ name: 'Referenced', slug: 'referenced', active: true });
            await Offering.create({ name: 'O', slug: 'o', project: 'referenced', category: 'Laubbaum' });
            await Post.create({ title: 'P', slug: 'p', project: 'referenced' });

            const token = generateToken({ projects: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('referenziert');
            expect(res.body.references).toBeDefined();
            expect(res.body.references.length).toBeGreaterThan(0);

            // Project should still exist
            expect(await Project.findById(project._id)).not.toBeNull();
        });

        it('should allow force delete even when referenced', async () => {
            const project = await Project.create({ name: 'Force Delete', slug: 'force-del', active: true });
            await Offering.create({ name: 'O', slug: 'o', project: 'force-del', category: 'Laubbaum' });

            const token = generateToken({ projects: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/projects/${project._id}?force=true`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await Project.findById(project._id)).toBeNull();

            // Offering still exists but with orphaned project ref
            const offering = await Offering.findOne({ slug: 'o' });
            expect(offering.project).toBe('force-del');
        });

        it('should delete without warning when no references exist', async () => {
            const project = await Project.create({ name: 'Unreferenced', slug: 'unreferenced', active: true });

            const token = generateToken({ projects: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await Project.findById(project._id)).toBeNull();
        });
    });
});
