import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Project from '../../src/models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Helper to generate a valid JWT
const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Projects API', () => {
    beforeEach(async () => {
        // Clear projects before each test
        await Project.deleteMany({});
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/projects', () => {
        it('should allow public read access', async () => {
            const project = new Project({ name: 'Public Project', slug: 'public', active: true });
            await project.save();

            const res = await request(app).get('/api/v1/projects');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Public Project');
        });

        it('should hide inactive projects for public users (publishedField)', async () => {
            await Project.create({ name: 'Active', slug: 'active', active: true });
            await Project.create({ name: 'Inactive', slug: 'inactive', active: false });

            const res = await request(app).get('/api/v1/projects');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Active');
        });

        it('should show all projects for admin users with read:all', async () => {
            await Project.create({ name: 'Active', slug: 'active', active: true });
            await Project.create({ name: 'Inactive', slug: 'inactive', active: false });

            const token = generateToken({ projects: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/projects')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it('should return 404 for unknown project detail', async () => {
            const res = await request(app).get('/api/v1/projects/unknown-slug');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/projects', () => {
        it('should deny creation without token (401)', async () => {
            const res = await request(app)
                .post('/api/v1/projects')
                .send({ name: 'New Project', slug: 'new' });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Nicht authentifiziert');
        });

        it('should deny creation with token but missing permission (403)', async () => {
            const token = generateToken({ projects: { read: 'all' } }); // No 'create' permission
            const res = await request(app)
                .post('/api/v1/projects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Project', slug: 'new' });
            
            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Aktion create auf projects verweigert');
        });

        it('should allow creation with valid permissions', async () => {
            const token = generateToken({ projects: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/projects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Valid Project', slug: 'valid' });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.name).toBe('Valid Project');

            // Verify it was saved to DB
            const dbProject = await Project.findOne({ slug: 'valid' });
            expect(dbProject).not.toBeNull();
        });
    });

    describe('DELETE /api/v1/projects/:id', () => {
        it('should deny deletion without correct permissions', async () => {
            const project = new Project({ name: 'To Delete', slug: 'to-delete', active: true });
            await project.save();

            const token = generateToken({ projects: { read: 'all', update: 'all' } }); // No delete
            const res = await request(app)
                .delete(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(403);

            // Verify it's still in DB
            const dbProject = await Project.findById(project._id);
            expect(dbProject).not.toBeNull();
        });

        it('should allow deletion with valid permissions', async () => {
            const project = new Project({ name: 'To Delete', slug: 'to-delete', active: true });
            await project.save();

            const token = generateToken({ projects: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/projects/${project._id}`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(200);

            // Verify it's gone
            const dbProject = await Project.findById(project._id);
            expect(dbProject).toBeNull();
        });
    });
});
