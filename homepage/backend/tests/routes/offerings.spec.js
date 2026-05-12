import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Offering from '../../src/models/Offering.js';
import Project from '../../src/models/Project.js';
import Tree from '../../src/models/Tree.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Offerings API', () => {
    let testProject, testTree;

    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;

        testProject = new Project({ name: 'Test Project', slug: 'test-project', active: true });
        await testProject.save();

        testTree = new Tree({ name: 'Eiche', slug: 'eiche', category: 'Laubbaum' });
        await testTree.save();
    });

    describe('GET /api/v1/offerings', () => {
        it('should allow public read access', async () => {
            const offering = new Offering({
                name: 'Test Offering',
                project: testProject._id,
                tree: testTree._id,
                category: 'Laubbaum',
                available: true
            });
            await offering.save();

            const res = await request(app).get('/api/v1/offerings');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Test Offering');
        });

        it('should populate tree data', async () => {
            const offering = new Offering({
                name: 'Populated Offering',
                project: testProject._id,
                tree: testTree._id,
                category: 'Laubbaum',
                available: true
            });
            await offering.save();

            const res = await request(app).get('/api/v1/offerings');
            expect(res.statusCode).toBe(200);
            expect(res.body[0].tree).toBeDefined();
            expect(res.body[0].tree.name).toBe('Eiche');
        });

        it('should filter by project slug via resolveParams', async () => {
            const otherProject = new Project({ name: 'Other', slug: 'other-project', active: true });
            await otherProject.save();

            await Offering.create({ name: 'A', project: testProject._id, category: 'Laubbaum', available: true });
            await Offering.create({ name: 'B', project: otherProject._id, category: 'Obstbaum', available: true });

            const res = await request(app).get('/api/v1/offerings?project=test-project');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('A');
        });

        it('should filter by availability', async () => {
            await Offering.create({ name: 'Available', project: testProject._id, category: 'Laubbaum', available: true });
            await Offering.create({ name: 'Sold Out', project: testProject._id, category: 'Obstbaum', available: false });

            const res = await request(app).get('/api/v1/offerings?available=true');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Available');
        });
    });

    describe('POST /api/v1/offerings', () => {
        it('should deny creation without token', async () => {
            const res = await request(app)
                .post('/api/v1/offerings')
                .send({ name: 'New', project: testProject._id, category: 'Laubbaum' });

            expect(res.statusCode).toBe(401);
        });

        it('should create with valid permissions', async () => {
            const token = generateToken({ offerings: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/offerings')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Neue Eiche', project: testProject._id, category: 'Laubbaum' });

            expect(res.statusCode).toBe(201);
            expect(res.body.name).toBe('Neue Eiche');
        });
    });

    describe('DELETE /api/v1/offerings/:id', () => {
        it('should delete with valid permissions', async () => {
            const offering = await Offering.create({
                name: 'Delete Me', project: testProject._id, category: 'Laubbaum'
            });

            const token = generateToken({ offerings: { delete: 'all' } });
            const res = await request(app)
                .delete(`/api/v1/offerings/${offering._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await Offering.findById(offering._id)).toBeNull();
        });
    });
});
