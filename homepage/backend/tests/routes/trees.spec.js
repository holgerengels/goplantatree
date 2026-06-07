import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Tree from '../../src/models/Tree.js';
import Offering from '../../src/models/Offering.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Trees API (Soft Refs)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('GET /api/v1/trees', () => {
        it('should allow public read with image as slug string', async () => {
            await Tree.create({ name: 'Eiche', slug: 'eiche', image: 'eiche-foto' });

            const res = await request(app).get('/api/v1/trees');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].image).toBe('eiche-foto');
            expect(typeof res.body[0].image).toBe('string');
        });
    });

    describe('POST /api/v1/trees', () => {
        it('should create tree with image slug', async () => {
            const token = generateToken({ trees: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/trees')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Esche', slug: 'esche', image: 'esche-bild' });

            expect(res.statusCode).toBe(201);
            expect(res.body.image).toBe('esche-bild');
        });
    });

    describe('PUT /api/v1/trees/:id (Slug Cascade)', () => {
        it('should cascade update offering.tree when tree slug changes', async () => {
            const tree = await Tree.create({ name: 'Linde', slug: 'linde' });
            await Offering.create({ name: 'O1', slug: 'o1', project: 'proj', tree: 'linde', category: 'Laubbaum' });
            await Offering.create({ name: 'O2', slug: 'o2', project: 'proj', tree: 'linde', category: 'Laubbaum' });

            const token = generateToken({ trees: { update: 'all' } });
            const res = await request(app)
                .put(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Winterlinde', slug: 'winterlinde' });

            expect(res.statusCode).toBe(200);
            expect(res.body.slug).toBe('winterlinde');
            expect(res.body._cascade).toBeDefined();
            expect(res.body._cascade.totalUpdated).toBe(2);

            // Verify cascade
            expect(await Offering.find({ tree: 'winterlinde' })).toHaveLength(2);
            expect(await Offering.find({ tree: 'linde' })).toHaveLength(0);
        });
    });

    describe('DELETE /api/v1/trees/:id (Ref Integrity)', () => {
        it('should return 409 when tree is referenced by offerings', async () => {
            const tree = await Tree.create({ name: 'Buche', slug: 'buche' });
            await Offering.create({ name: 'O', slug: 'o', project: 'proj', tree: 'buche', category: 'Laubbaum' });

            const token = generateToken({ trees: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('referenziert');
            expect(await Tree.findById(tree._id)).not.toBeNull();
        });

        it('should allow force-delete of referenced tree', async () => {
            const tree = await Tree.create({ name: 'Buche', slug: 'buche' });
            await Offering.create({ name: 'O', slug: 'o', project: 'proj', tree: 'buche', category: 'Laubbaum' });

            const token = generateToken({ trees: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/trees/${tree._id}?force=true`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await Tree.findById(tree._id)).toBeNull();
        });

        it('should delete unreferenced tree without warning', async () => {
            const tree = await Tree.create({ name: 'Solo', slug: 'solo' });

            const token = generateToken({ trees: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
        });
    });
});
