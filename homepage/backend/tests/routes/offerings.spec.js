import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Offering from '../../src/models/Offering.js';
import Project from '../../src/models/Project.js';
import Tree from '../../src/models/Tree.js';
import Media from '../../src/models/Media.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Offerings API (Soft Refs)', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        await Project.create({ name: 'Test Project', slug: 'test-project', active: true });
        await Tree.create({ name: 'Eiche', slug: 'eiche', category: 'Laubbaum' });
        await Media.create({
            filename: 'tree.jpg', originalName: 'tree.jpg', slug: 'tree-image',
            mimeType: 'image/jpeg', size: 1024, url: '/api/v1/media/x/file',
            data: Buffer.from('fake')
        });
    });

    describe('GET /api/v1/offerings', () => {
        it('should list offerings with slug-based references', async () => {
            await Offering.create({
                name: 'Slug Offering', slug: 'slug-offering',
                project: 'test-project', tree: 'eiche', image: 'tree-image',
                category: 'Laubbaum', available: true
            });

            const res = await request(app).get('/api/v1/offerings');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);

            const offering = res.body[0];
            expect(offering.project).toBe('test-project');
            expect(offering.tree).toBe('eiche');
            expect(offering.image).toBe('tree-image');
            // No populated objects — just slug strings
            expect(typeof offering.project).toBe('string');
            expect(typeof offering.tree).toBe('string');
        });

        it('should filter by project slug directly', async () => {
            await Offering.create({ name: 'A', slug: 'a', project: 'test-project', category: 'Laubbaum', available: true });
            await Offering.create({ name: 'B', slug: 'b', project: 'other-project', category: 'Obstbaum', available: true });

            const res = await request(app).get('/api/v1/offerings?project=test-project');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('A');
        });

        it('should filter by availability', async () => {
            await Offering.create({ name: 'Available', slug: 'avail', project: 'test-project', category: 'Laubbaum', available: true });
            await Offering.create({ name: 'Sold Out', slug: 'sold', project: 'test-project', category: 'Obstbaum', available: false });

            const res = await request(app).get('/api/v1/offerings?available=true');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Available');
        });
    });

    describe('POST /api/v1/offerings', () => {
        it('should create offering with slug-based references', async () => {
            const token = generateToken({ offerings: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/offerings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Neue Eiche', slug: 'neue-eiche',
                    project: 'test-project', tree: 'eiche', image: 'tree-image',
                    category: 'Laubbaum'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.project).toBe('test-project');
            expect(res.body.tree).toBe('eiche');
            expect(res.body.image).toBe('tree-image');

            // Verify DB
            const dbOffering = await Offering.findOne({ slug: 'neue-eiche' });
            expect(dbOffering.project).toBe('test-project');
            expect(dbOffering.tree).toBe('eiche');
            expect(dbOffering.image).toBe('tree-image');
        });

        it('should accept null for optional slug refs', async () => {
            const token = generateToken({ offerings: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/offerings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Ohne Bild', slug: 'ohne-bild',
                    project: 'test-project', category: 'Laubbaum'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.tree).toBeNull();
            expect(res.body.image).toBeNull();
        });

        it('should accept a non-existent slug (graceful handling)', async () => {
            const token = generateToken({ offerings: { create: 'all' } });
            const res = await request(app)
                .post('/api/v1/offerings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Ghost Ref', slug: 'ghost',
                    project: 'test-project', tree: 'non-existent-tree',
                    category: 'Laubbaum'
                });

            // Should save fine — soft refs don't validate existence
            expect(res.statusCode).toBe(201);
            expect(res.body.tree).toBe('non-existent-tree');
        });

        it('should deny creation without token', async () => {
            const res = await request(app)
                .post('/api/v1/offerings')
                .send({ name: 'New', project: 'test-project', category: 'Laubbaum' });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/v1/offerings/:slug', () => {
        it('should find offering by slug', async () => {
            await Offering.create({
                name: 'Findable', slug: 'findable',
                project: 'test-project', category: 'Laubbaum'
            });

            const res = await request(app).get('/api/v1/offerings/findable');
            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('Findable');
            expect(res.body.project).toBe('test-project');
        });
    });
});
