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

describe('Subscribers API', () => {
    let testProject;

    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.SITE_URL = 'https://test.example.com';
        await Subscriber.init();
        testProject = await Project.create({ name: 'Test', slug: 'test-project', active: true });
        sendMail.mockClear();
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

        it('should send confirmation email after subscribe', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'mail@example.com', name: 'Max' });

            expect(sendMail).toHaveBeenCalledTimes(1);

            const call = sendMail.mock.calls[0];
            // Account key should be 'info' (fallback)
            expect(call[0]).toBe('info');
            // Mail options
            expect(call[1].to).toBe('mail@example.com');
            expect(call[1].subject).toContain('bestätige');
            expect(call[1].template).toBe('subscribe-confirm');

            // Confirm URL should contain the token
            const sub = await Subscriber.findOne({ email: 'mail@example.com' });
            expect(call[1].html).toContain(sub.confirmToken);
            expect(call[1].html).toContain('https://test.example.com/bestaetigen/');
        });

        it('should still succeed if confirmation email fails', async () => {
            sendMail.mockRejectedValueOnce(new Error('SMTP down'));

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'fail@example.com' });

            // Subscribe should still succeed despite mail error
            expect(res.statusCode).toBe(201);
            const sub = await Subscriber.findOne({ email: 'fail@example.com' });
            expect(sub).not.toBeNull();
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

    describe('GET /api/v1/subscribers/unsubscribe/:token', () => {
        it('should unsubscribe and delete subscriber', async () => {
            const sub = await Subscriber.create({
                email: 'unsub@example.com',
                name: 'Unsub User',
                project: testProject._id,
                topic: 'general'
            });

            const res = await request(app)
                .get(`/api/v1/subscribers/unsubscribe/${sub.confirmToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('abgemeldet');
            expect(res.body.email).toBe('unsub@example.com');
            expect(res.body.project).toBe('test-project');

            const deleted = await Subscriber.findById(sub._id);
            expect(deleted).toBeNull();
        });

        it('should return 404 for invalid unsubscribe token', async () => {
            const res = await request(app)
                .get('/api/v1/subscribers/unsubscribe/invalidtoken');

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

