import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Project from '../../src/models/Project.js';
import Tree from '../../src/models/Tree.js';
import ChangeLog from '../../src/models/ChangeLog.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}, extra = {}) => {
    return jwt.sign({ id: 'user123', username: 'testadmin', permissions, ...extra }, JWT_SECRET);
};

const adminPerms = {
    trees: { read: 'all', create: 'all', update: 'all', delete: 'all' },
    changelog: { read: 'all' }
};

describe('ChangeLog Integration', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('Create logging', () => {
        it('should create a changelog entry on POST (create)', async () => {
            const token = generateToken(adminPerms);
            const res = await request(app)
                .post('/api/v1/trees')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Testbaum', slug: 'testbaum', category: 'Laubbaum' });

            expect(res.status).toBe(201);

            // Wait for fire-and-forget to complete
            await new Promise(r => setTimeout(r, 100));

            const logs = await ChangeLog.find({ resource: 'trees', action: 'create' });
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.user).toBe('testadmin');
            expect(log.documentId).toBe(res.body._id);
            expect(log.documentSlug).toBe('testbaum');
            expect(log.before).toBeNull();
            expect(log.after).toBeDefined();
            expect(log.after.name).toBe('Testbaum');
        });
    });

    describe('Update logging', () => {
        it('should create a changelog entry on PUT (update) with diff', async () => {
            const token = generateToken(adminPerms);
            const tree = await Tree.create({ name: 'Eiche', slug: 'eiche', category: 'Laubbaum' });

            const res = await request(app)
                .put(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eiche', slug: 'eiche', category: 'Nadelbaum' });

            expect(res.status).toBe(200);

            await new Promise(r => setTimeout(r, 100));

            const logs = await ChangeLog.find({ resource: 'trees', action: 'update' });
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.user).toBe('testadmin');
            expect(log.before.category).toBe('Laubbaum');
            expect(log.after.category).toBe('Nadelbaum');
            expect(log.diff).toBeDefined();
            expect(log.diff.category.from).toBe('Laubbaum');
            expect(log.diff.category.to).toBe('Nadelbaum');
        });
    });

    describe('Delete logging', () => {
        it('should create a changelog entry on DELETE (single)', async () => {
            const token = generateToken(adminPerms);
            const tree = await Tree.create({ name: 'Birke', slug: 'birke' });

            const res = await request(app)
                .delete(`/api/v1/trees/${tree._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);

            await new Promise(r => setTimeout(r, 100));

            const logs = await ChangeLog.find({ resource: 'trees', action: 'delete' });
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.before.name).toBe('Birke');
            expect(log.after).toBeNull();
        });

        it('should create individual changelog entries on bulk DELETE with metadata.source=bulk', async () => {
            const token = generateToken(adminPerms);
            const t1 = await Tree.create({ name: 'Ahorn', slug: 'ahorn' });
            const t2 = await Tree.create({ name: 'Buche', slug: 'buche' });

            const res = await request(app)
                .delete('/api/v1/trees')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids: [t1._id.toString(), t2._id.toString()] });

            expect(res.status).toBe(200);

            await new Promise(r => setTimeout(r, 100));

            const logs = await ChangeLog.find({ resource: 'trees', action: 'delete' }).sort({ documentSlug: 1 });
            expect(logs).toHaveLength(2);

            expect(logs[0].documentSlug).toBe('ahorn');
            expect(logs[0].metadata).toBeDefined();
            expect(logs[0].metadata.source).toBe('bulk');
            expect(logs[1].documentSlug).toBe('buche');
            expect(logs[1].metadata.source).toBe('bulk');
        });
    });

    describe('Changelog API', () => {
        it('should deny access without changelog:read permission', async () => {
            const token = generateToken({ trees: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/changelog')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(403);
        });

        it('should return paginated changelog entries', async () => {
            const token = generateToken(adminPerms);

            // Create some changelog entries
            await ChangeLog.create([
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'id1', after: { name: 'A' } },
                { user: 'admin', resource: 'trees', action: 'update', documentId: 'id1', before: { name: 'A' }, after: { name: 'B' } },
                { user: 'admin', resource: 'orders', action: 'create', documentId: 'id2', after: { name: 'C' } }
            ]);

            const res = await request(app)
                .get('/api/v1/changelog')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(3);
            expect(res.body.total).toBe(3);
        });

        it('should filter by resource', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create([
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'id1' },
                { user: 'admin', resource: 'orders', action: 'create', documentId: 'id2' }
            ]);

            const res = await request(app)
                .get('/api/v1/changelog?resource=trees')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].resource).toBe('trees');
        });

        it('should filter by action', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create([
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'id1' },
                { user: 'admin', resource: 'trees', action: 'delete', documentId: 'id2' }
            ]);

            const res = await request(app)
                .get('/api/v1/changelog?action=delete')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].action).toBe('delete');
        });

        it('should return changelog entries for a specific document', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create([
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'doc1' },
                { user: 'admin', resource: 'trees', action: 'update', documentId: 'doc1' },
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'doc2' }
            ]);

            const res = await request(app)
                .get('/api/v1/changelog/doc1')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });

        it('should exclude before/after from list response', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create({
                user: 'admin',
                resource: 'trees',
                action: 'update',
                documentId: 'id1',
                before: { name: 'Old Name', category: 'Laubbaum' },
                after: { name: 'New Name', category: 'Laubbaum' },
                diff: { name: { from: 'Old Name', to: 'New Name' } }
            });

            const res = await request(app)
                .get('/api/v1/changelog')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);

            const item = res.body.items[0];
            // before and after should be excluded from list
            expect(item.before).toBeUndefined();
            expect(item.after).toBeUndefined();
            // diff should still be present
            expect(item.diff).toBeDefined();
            expect(item.diff.name.from).toBe('Old Name');
            expect(item.diff.name.to).toBe('New Name');
        });

        it('should include before/after in detail response', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create({
                user: 'admin',
                resource: 'trees',
                action: 'update',
                documentId: 'detail-doc',
                before: { name: 'Old Name' },
                after: { name: 'New Name' },
                diff: { name: { from: 'Old Name', to: 'New Name' } }
            });

            const res = await request(app)
                .get('/api/v1/changelog/detail-doc')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);

            const entry = res.body[0];
            // Detail response should include full data
            expect(entry.before).toBeDefined();
            expect(entry.before.name).toBe('Old Name');
            expect(entry.after).toBeDefined();
            expect(entry.after.name).toBe('New Name');
        });

        it('should return distinct values for a field', async () => {
            const token = generateToken(adminPerms);

            await ChangeLog.create([
                { user: 'admin', resource: 'trees', action: 'create', documentId: 'id1' },
                { user: 'admin', resource: 'orders', action: 'create', documentId: 'id2' },
                { user: 'admin', resource: 'trees', action: 'update', documentId: 'id3' }
            ]);

            const res = await request(app)
                .get('/api/v1/changelog/distinct/resource')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(['orders', 'trees']);
        });

        it('should reject invalid field names for distinct', async () => {
            const token = generateToken(adminPerms);

            const res = await request(app)
                .get('/api/v1/changelog/distinct/$invalid')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(400);
        });
    });
});
