import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Subscriber from '../../src/models/Subscriber.js';
import Project from '../../src/models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Subscribers API', () => {
    let testProject;

    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        testProject = await Project.create({ name: 'Test', slug: 'test-project', active: true });
    });

    describe('POST /api/v1/subscribers', () => {
        it('should allow public subscription', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'test@example.com', name: 'Test User', project: testProject._id });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toContain('Erfolgreich angemeldet');

            const sub = await Subscriber.findOne({ email: 'test@example.com' });
            expect(sub).not.toBeNull();
            expect(sub.confirmToken).toBeDefined();
            expect(sub.confirmed).toBe(false);
        });

        it('should resolve project slug to ObjectId', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'slug@example.com', project: 'test-project' });

            expect(res.statusCode).toBe(201);
            const sub = await Subscriber.findOne({ email: 'slug@example.com' });
            expect(sub.project.toString()).toBe(testProject._id.toString());
        });

        it('should reject duplicate email per project+topic', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: testProject._id });

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: testProject._id });

            expect(res.statusCode).toBe(409);
        });
    });

    describe('GET /api/v1/subscribers/confirm/:token', () => {
        it('should confirm subscription with valid token', async () => {
            const sub = await Subscriber.create({
                email: 'confirm@example.com',
                project: testProject._id
            });

            const res = await request(app)
                .get(`/api/v1/subscribers/confirm/${sub.confirmToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('bestätigt');

            const updated = await Subscriber.findById(sub._id);
            expect(updated.confirmed).toBe(true);
        });

        it('should return 404 for invalid token', async () => {
            const res = await request(app)
                .get('/api/v1/subscribers/confirm/invalidtoken123');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /api/v1/subscribers', () => {
        it('should deny list access without auth', async () => {
            const res = await request(app).get('/api/v1/subscribers');
            expect(res.statusCode).toBe(401);
        });

        it('should return subscribers with auth', async () => {
            await Subscriber.create({ email: 'a@test.com', project: testProject._id });

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
        });

        it('should filter by project slug', async () => {
            const other = await Project.create({ name: 'Other', slug: 'other', active: true });
            await Subscriber.create({ email: 'a@test.com', project: testProject._id });
            await Subscriber.create({ email: 'b@test.com', project: other._id });

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers?project=test-project')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].email).toBe('a@test.com');
        });
    });
});
