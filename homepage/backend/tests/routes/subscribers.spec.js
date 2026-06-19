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

        it('should reject duplicate email per project', async () => {
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
            expect(updated.status).toContain('confirmed');
        });
    });

    describe('GET /api/v1/subscribers/unsubscribe/:token', () => {
        it('should unsubscribe and return project slug', async () => {
            const sub = await Subscriber.create({
                email: 'unsub@example.com',
                name: 'Unsub User',
                project: 'test-project',
                topics: ['general']
            });

            const res = await request(app)
                .get(`/api/v1/subscribers/unsubscribe/${sub.confirmToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('abgemeldet');
            expect(res.body.email).toBe('unsub@example.com');
            // project is now a slug string, not a populated object
            expect(res.body.project).toBe('test-project');

            const updated = await Subscriber.findById(sub._id);
            expect(updated).not.toBeNull();
            expect(updated.status).toContain('unsubscribed');
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
            expect(res.body[0].project).toBe('test-project');
        });
    });

    describe('POST /api/v1/subscribers/import', () => {
        it('should import subscribers from a CSV file', async () => {
            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                'import1@example.com,Import 1,general,test-project',
                'import2@example.com,Import 2,pflanzung,other-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(2);
            expect(res.body.skipped).toBe(0);
            expect(res.body.errors).toHaveLength(0);

            const sub1 = await Subscriber.findOne({ email: 'import1@example.com' });
            expect(sub1).not.toBeNull();
            expect(sub1.name).toBe('Import 1');
            expect(sub1.project).toBe('test-project');

            const sub2 = await Subscriber.findOne({ email: 'import2@example.com' });
            expect(sub2).not.toBeNull();
            expect(sub2.name).toBe('Import 2');
            expect(sub2.project).toBe('other-project');
        });

        it('should skip duplicate records on unique index constraint', async () => {
            await Subscriber.create({ email: 'dup-import@example.com', project: 'test-project', topics: ['general'] });

            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                'dup-import@example.com,Dup Name,general,test-project',
                'new-import@example.com,New Name,general,test-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(1);
            expect(res.body.skipped).toBe(1);
            expect(res.body.errors).toHaveLength(0);

            const count = await Subscriber.countDocuments({ email: 'dup-import@example.com' });
            expect(count).toBe(1);
        });

        it('should enforce own project scope on import', async () => {
            const token = jwt.sign({ 
                id: 'user123', 
                project: 'test-project',
                permissions: { subscribers: { create: 'own' } } 
            }, JWT_SECRET);

            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                'scoped@example.com,Scoped,general,other-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(1);

            const sub = await Subscriber.findOne({ email: 'scoped@example.com' });
            expect(sub.project).toBe('test-project');
        });

        it('should list validation errors for rows with invalid data', async () => {
            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                ',No Email,general,test-project',
                'valid-err@example.com,Valid,general,test-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(1);
            expect(res.body.skipped).toBe(0);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].row).toBe(2);
            expect(res.body.errors[0].error).toContain('required');
        });
    });
});
