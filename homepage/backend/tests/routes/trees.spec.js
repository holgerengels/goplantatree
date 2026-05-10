import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Tree from '../../src/models/Tree.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Trees API', () => {
    beforeEach(async () => {
        await Tree.deleteMany({});
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/trees', () => {
        it('should allow public read access', async () => {
            const tree = new Tree({ name: 'Eiche', slug: 'eiche' });
            await tree.save();

            const res = await request(app).get('/api/v1/trees');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Eiche');
        });

        it('should return 404 for unknown tree detail', async () => {
            const res = await request(app).get('/api/v1/trees/unknown-slug');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/trees', () => {
        it('should deny creation without token (401)', async () => {
            const res = await request(app)
                .post('/api/v1/trees')
                .send({ name: 'Buche' });
            
            expect(res.statusCode).toBe(401);
        });

        it('should return 400 Bad Request on validation failure (missing name)', async () => {
            const token = generateToken({ trees: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/trees')
                .set('Authorization', `Bearer ${token}`)
                .send({ category: 'Laubbaum' }); // Missing required name
            
            expect(res.statusCode).toBe(400);
        });

        it('should allow creation with valid permissions and required fields', async () => {
            const token = generateToken({ trees: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/trees')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Esche', slug: 'esche' });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.name).toBe('Esche');

            const dbTree = await Tree.findOne({ slug: 'esche' });
            expect(dbTree).not.toBeNull();
        });
    });

    describe('PUT /api/v1/trees/:id', () => {
        it('should update an existing tree', async () => {
            const tree = new Tree({ name: 'Linde', slug: 'linde' });
            await tree.save();

            const token = generateToken({ trees: { update: 'all' } });
            const res = await request(app)
                .put(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Winterlinde' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('Winterlinde');
        });
    });

    describe('DELETE /api/v1/trees/:id', () => {
        it('should delete a tree with valid permissions', async () => {
            const tree = new Tree({ name: 'Kastanie', slug: 'kastanie' });
            await tree.save();

            const token = generateToken({ trees: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(200);

            const dbTree = await Tree.findById(tree._id);
            expect(dbTree).toBeNull();
        });
    });
});
