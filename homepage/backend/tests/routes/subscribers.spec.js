import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Subscriber from '../../src/models/Subscriber.js';
import Project from '../../src/models/Project.js';

// Mock sendMail to avoid SMTP calls in tests
vi.mock('../../src/utils/mailService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        sendMail: vi.fn().mockResolvedValue({ status: 'sent' })
    };
});
import { sendMail } from '../../src/utils/mailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Subscribers API (Soft Refs)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.SITE_URL = 'https://test.example.com';
        await Subscriber.init();
        await Project.create({ name: 'Test', slug: 'test-project', active: true });
        sendMail.mockClear();
    });

    describe('POST /api/v1/subscribers', () => {
        it('should store project as slug string directly', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'slug@example.com', project: 'test-project' });

            expect(res.statusCode).toBe(201);
            const sub = await Subscriber.findOne({ email: 'slug@example.com' });
            expect(sub.project).toBe('test-project');
            expect(typeof sub.project).toBe('string');
        });

        it('should allow subscription without project', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'noproject@example.com', name: 'Test' });

            expect(res.statusCode).toBe(201);
            const sub = await Subscriber.findOne({ email: 'noproject@example.com' });
            expect(sub).not.toBeNull();
            expect(sub.confirmToken).toBeDefined();
        });

        it('should reject duplicate email per project+topic', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: 'test-project' });

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: 'test-project' });

            expect(res.statusCode).toBe(409);
        });

        it('should send confirmation email after subscribe', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'mail@example.com', name: 'Max' });

            expect(sendMail).toHaveBeenCalledTimes(1);
            const call = sendMail.mock.calls[0];
            expect(call[0]).toBe('info');
            expect(call[1].to).toBe('mail@example.com');
            expect(call[1].subject).toContain('bestätige');
        });
    });

    describe('GET /api/v1/subscribers/confirm/:token', () => {
        it('should confirm subscription with valid token', async () => {
            const sub = await Subscriber.create({
                email: 'confirm@example.com',
                project: 'test-project'
            });

            const res = await request(app)
                .get(`/api/v1/subscribers/confirm/${sub.confirmToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('bestätigt');

            const updated = await Subscriber.findById(sub._id);
            expect(updated.confirmed).toBe(true);
        });
    });

    describe('GET /api/v1/subscribers/unsubscribe/:token', () => {
        it('should unsubscribe and return project slug', async () => {
            const sub = await Subscriber.create({
                email: 'unsub@example.com',
                name: 'Unsub User',
                project: 'test-project',
                topic: 'general'
            });

            const res = await request(app)
                .get(`/api/v1/subscribers/unsubscribe/${sub.confirmToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('abgemeldet');
            expect(res.body.email).toBe('unsub@example.com');
            // project is now a slug string, not a populated object
            expect(res.body.project).toBe('test-project');

            expect(await Subscriber.findById(sub._id)).toBeNull();
        });
    });

    describe('GET /api/v1/subscribers (admin, slug filter)', () => {
        it('should deny list access without auth', async () => {
            const res = await request(app).get('/api/v1/subscribers');
            expect(res.statusCode).toBe(401);
        });

        it('should filter subscribers by project slug directly', async () => {
            await Subscriber.create({ email: 'a@test.com', project: 'test-project' });
            await Subscriber.create({ email: 'b@test.com', project: 'other-project' });

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers?project=test-project')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].email).toBe('a@test.com');
            expect(res.body[0].project).toBe('test-project');
        });
    });
});
