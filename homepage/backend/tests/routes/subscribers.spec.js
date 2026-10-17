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
        it('should reject subscription when project has no mail account', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'slug@example.com', project: 'test-project' });

            expect(res.statusCode).toBe(400);
            const sub = await Subscriber.findOne({ email: 'slug@example.com' });
            expect(sub).toBeNull();
        });

        it('should reject subscription without project', async () => {
            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'noproject@example.com', name: 'Test' });

            expect(res.statusCode).toBe(400);
            const sub = await Subscriber.findOne({ email: 'noproject@example.com' });
            expect(sub).toBeNull();
        });

        it('should send confirmation email when project has mail account', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'mail@example.com', name: 'Max', project: 'klimabaumaktion-ulm' });

            expect(sendMail).toHaveBeenCalledTimes(1);
            const call = sendMail.mock.calls[0];
            expect(call[0]).toBe('klimabaumaktion-ulm');
            expect(call[1].to).toBe('mail@example.com');
            expect(call[1].subject).toContain('bestätige');
        });

        it('should reject duplicate email per project', async () => {
            await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: 'klimabaumaktion-ulm' });

            const res = await request(app)
                .post('/api/v1/subscribers')
                .send({ email: 'dup@example.com', project: 'klimabaumaktion-ulm' });

            expect(res.statusCode).toBe(409);
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

        it('should return { items, total } with ?paged=true and respect limit/skip', async () => {
            for (let i = 0; i < 5; i++) {
                await Subscriber.create({ email: `page${i}@test.com`, project: 'test-project' });
            }

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers?paged=true&limit=2&skip=2')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(5);
            expect(res.body.items).toHaveLength(2);
        });

        it('should return all items as plain array without ?paged (no silent truncation at 100)', async () => {
            await Subscriber.insertMany(
                Array.from({ length: 120 }, (_, i) => ({ email: `bulk${i}@test.com`, project: 'test-project' }))
            );

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(120);
        });

        it('should default to page size 100 with ?paged=true and no limit', async () => {
            await Subscriber.insertMany(
                Array.from({ length: 120 }, (_, i) => ({ email: `bulkp${i}@test.com`, project: 'test-project' }))
            );

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers?paged=true')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(120);
            expect(res.body.items).toHaveLength(100);
        });

        it('should return only the total with ?count=true', async () => {
            await Subscriber.create({ email: 'c1@test.com', project: 'test-project' });
            await Subscriber.create({ email: 'c2@test.com', project: 'other-project' });

            const token = generateToken({ subscribers: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/subscribers?count=true&project=test-project')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ total: 1 });
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
            await Subscriber.create({ email: 'dup-import@example.com', name: 'Dup Name', project: 'test-project', topics: ['general'] });

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

        it('should merge new topics into existing subscriber on duplicate import', async () => {
            await Subscriber.create({ email: 'merge-topic@example.com', project: 'test-project', topics: ['general'] });

            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                'merge-topic@example.com,Merge Name,klimabaumaktion,test-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(0);
            expect(res.body.updated).toBe(1);
            expect(res.body.skipped).toBe(0);
            expect(res.body.errors).toHaveLength(0);
            expect(res.body.updatedItems).toHaveLength(1);
            expect(res.body.updatedItems[0].email).toBe('merge-topic@example.com');

            const sub = await Subscriber.findOne({ email: 'merge-topic@example.com' });
            expect(sub.topics).toContain('general');
            expect(sub.topics).toContain('klimabaumaktion');
            expect(sub.topics).toHaveLength(2);
            expect(sub.name).toBe('Merge Name');
        });

        it('should merge data.* columns into existing subscriber data on duplicate import', async () => {
            await Subscriber.create({
                email: 'merge-data@example.com',
                project: 'test-project',
                topics: ['general'],
                data: { tree: 'Eiche', zeitfenster: '10:00 Uhr' }
            });

            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Themen,Projekt,data.zeitfenster,data.orderNumber',
                'merge-data@example.com,general,test-project,11:00 Uhr,ORD-42'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.updated).toBe(1);

            const sub = await Subscriber.findOne({ email: 'merge-data@example.com' });
            expect(sub.data).toEqual({ tree: 'Eiche', zeitfenster: '11:00 Uhr', orderNumber: 'ORD-42' });
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

        it('should map data.* columns into subscriber.data and default status to confirmed', async () => {
            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt,data.tree,data.zeitfenster,data.orderNumber',
                'payload@example.com,Payload User,besteller,test-project,Winterlinde,10:00 Uhr,ORD-1234'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(1);

            const sub = await Subscriber.findOne({ email: 'payload@example.com' });
            expect(sub).not.toBeNull();
            expect(sub.name).toBe('Payload User');
            expect(sub.status).toEqual(['confirmed']);
            expect(sub.data).toBeDefined();
            expect(sub.data.tree).toBe('Winterlinde');
            expect(sub.data.zeitfenster).toBe('10:00 Uhr');
            expect(sub.data.orderNumber).toBe('ORD-1234');
        });

        it('should return preview of first 3 rows without saving to DB when ?preview=true', async () => {
            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt,data.tree',
                'prev1@example.com,Prev 1,besteller,test-project,Eiche',
                'prev2@example.com,Prev 2,besteller,test-project,Buche',
                'prev3@example.com,Prev 3,besteller,test-project,Ahorn',
                'prev4@example.com,Prev 4,besteller,test-project,Kiefer'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import?preview=true')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.totalRows).toBe(4);
            expect(res.body.preview).toHaveLength(3);
            expect(res.body.preview[0].data.email).toBe('prev1@example.com');
            expect(res.body.preview[0].data.data.tree).toBe('Eiche');
            expect(res.body.preview[0].data.status).toEqual(['confirmed']);

            // Verify nothing was saved to DB
            const count = await Subscriber.countDocuments({ email: { $in: ['prev1@example.com', 'prev2@example.com'] } });
            expect(count).toBe(0);
        });

        it('should return detailed skippedItems on duplicate email', async () => {
            await Subscriber.create({ email: 'existing@example.com', name: 'Existing User', project: 'test-project' });

            const token = generateToken({ subscribers: { create: 'all' } });
            const csvData = [
                'E-Mail,Name,Themen,Projekt',
                'existing@example.com,Existing User,general,test-project',
                'fresh@example.com,Fresh User,general,test-project'
            ].join('\n');

            const res = await request(app)
                .post('/api/v1/subscribers/import')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', Buffer.from(csvData), 'subscribers.csv');

            expect(res.statusCode).toBe(200);
            expect(res.body.imported).toBe(1);
            expect(res.body.skipped).toBe(1);
            expect(res.body.skippedItems).toHaveLength(1);
            expect(res.body.skippedItems[0].row).toBe(2);
            expect(res.body.skippedItems[0].email).toBe('existing@example.com');
            expect(res.body.skippedItems[0].name).toBe('Existing User');
            expect(res.body.skippedItems[0].reason).toContain('bereits');
        });
    });
});
