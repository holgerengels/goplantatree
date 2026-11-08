import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import Post from '../../src/models/Post.js';
import GuestEdit from '../../src/models/GuestEdit.js';
import Media from '../../src/models/Media.js';

vi.mock('../../src/utils/mailService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        sendMail: vi.fn().mockResolvedValue({ status: 'sent' })
    };
});
import { sendMail } from '../../src/utils/mailService.js';

describe('GuestEdit API (/api/v1/guest-edit)', () => {
    beforeEach(async () => {
        process.env.SITE_URL = 'https://test.example.com';
        await Post.deleteMany({});
        await GuestEdit.deleteMany({});
        await Media.deleteMany({});
        sendMail.mockClear();
    });

    describe('POST /api/v1/guest-edit/submit/posts', () => {
        it('should require author, valid email and title', async () => {
            const res = await request(app)
                .post('/api/v1/guest-edit/submit/posts')
                .send({ title: 'Mein Baum' });
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Namen');
        });

        it('should reject invalid email format', async () => {
            const res = await request(app)
                .post('/api/v1/guest-edit/submit/posts')
                .send({ author: 'Erika', email: 'not-an-email', title: 'Mein Baum' });
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('E-Mail');
        });

        it('should create an unpublished Post and a GuestEdit record and send confirmation mail', async () => {
            const res = await request(app)
                .post('/api/v1/guest-edit/submit/posts')
                .field('author', 'Erika Muster')
                .field('email', 'erika@example.com')
                .field('title', 'Apfelbaum gepflanzt')
                .field('content', '<p>Heute haben wir einen Apfelbaum eingepflanzt!</p>')
                .field('type', 'pflanzung');

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toContain('Bestätigungslink');

            const post = await Post.findOne({ title: 'Apfelbaum gepflanzt' });
            expect(post).toBeTruthy();
            expect(post.published).toBe(false);
            expect(post.type).toBe('pflanzung');
            expect(post.author).toBe('Erika Muster');
            expect(post.slug).toBe('apfelbaum-gepflanzt');
            expect(post.excerpt).toContain('Heute haben wir einen Apfelbaum eingepflanzt!');

            const guestEdit = await GuestEdit.findOne({ documentId: post._id });
            expect(guestEdit).toBeTruthy();
            expect(guestEdit.email).toBe('erika@example.com');
            expect(guestEdit.resource).toBe('posts');
            expect(guestEdit.confirmedAt).toBeNull();
            expect(guestEdit.allowedFields).toContain('title');
            expect(guestEdit.allowedFields).not.toContain('type');

            expect(sendMail).toHaveBeenCalledTimes(1);
            const mailOptions = sendMail.mock.calls[0][1];
            expect(mailOptions.to).toBe('erika@example.com');
            expect(mailOptions.html).toContain(`/bearbeiten/${guestEdit.token}`);
        });

        it('should handle optional uploaded image', async () => {
            // Minimal 1x1 GIF
            const fakeImage = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

            const res = await request(app)
                .post('/api/v1/guest-edit/submit/posts')
                .field('author', 'Erika')
                .field('email', 'erika@example.com')
                .field('title', 'Mit Foto')
                .field('content', '<p>Text</p>')
                .attach('file', fakeImage, 'baum.gif');

            expect(res.statusCode).toBe(201);
            const post = await Post.findOne({ title: 'Mit Foto' });
            expect(post.image).toBeTruthy();

            const media = await Media.findOne({ slug: post.image });
            expect(media).toBeTruthy();
            expect(media.originalName).toBe('baum.gif');
        });
    });

    describe('POST /api/v1/guest-edit/:token/confirm', () => {
        it('should return 404 for unknown token', async () => {
            const res = await request(app).post('/api/v1/guest-edit/unknown123/confirm').send({});
            expect(res.statusCode).toBe(404);
        });

        it('should publish the post on first confirmation and set confirmedAt', async () => {
            const post = await Post.create({
                title: 'Noch geheim',
                slug: 'noch-geheim',
                published: false,
                author: 'Tester'
            });
            const guestEdit = await GuestEdit.create({
                resource: 'posts',
                documentId: post._id,
                email: 'test@example.com',
                allowedFields: ['title', 'content', 'published']
            });

            const res = await request(app)
                .post(`/api/v1/guest-edit/${guestEdit.token}/confirm`)
                .send({});

            expect(res.statusCode).toBe(200);
            expect(res.body.justConfirmed).toBe(true);
            expect(res.body.item.published).toBe(true);

            const updatedPost = await Post.findById(post._id);
            expect(updatedPost.published).toBe(true);

            const updatedGuestEdit = await GuestEdit.findById(guestEdit._id);
            expect(updatedGuestEdit.confirmedAt).toBeTruthy();

            // Second call: should not report justConfirmed: true
            const res2 = await request(app)
                .post(`/api/v1/guest-edit/${guestEdit.token}/confirm`)
                .send({});
            expect(res2.statusCode).toBe(200);
            expect(res2.body.justConfirmed).toBe(false);
        });
    });

    describe('PUT /api/v1/guest-edit/:token', () => {
        it('should allow editing allowed fields (title, content, published)', async () => {
            const post = await Post.create({
                title: 'Alter Titel',
                slug: 'alter-titel',
                content: '<p>Alt</p>',
                published: true,
                author: 'Autor'
            });
            const guestEdit = await GuestEdit.create({
                resource: 'posts',
                documentId: post._id,
                email: 'test@example.com',
                allowedFields: ['title', 'content', 'published', 'author']
            });

            const res = await request(app)
                .put(`/api/v1/guest-edit/${guestEdit.token}`)
                .field('title', 'Neuer Titel')
                .field('content', '<p>Neuer Text</p>')
                .field('published', 'false');

            expect(res.statusCode).toBe(200);
            expect(res.body.item.title).toBe('Neuer Titel');
            expect(res.body.item.published).toBe(false);

            const updated = await Post.findById(post._id);
            expect(updated.title).toBe('Neuer Titel');
            expect(updated.published).toBe(false);
            expect(updated.content).toContain('Neuer Text');
        });

        it('should strip script tags from guest content', async () => {
            const post = await Post.create({
                title: 'Titel',
                slug: 'titel',
                published: true
            });
            const guestEdit = await GuestEdit.create({
                resource: 'posts',
                documentId: post._id,
                email: 'test@example.com',
                allowedFields: ['content']
            });

            const res = await request(app)
                .put(`/api/v1/guest-edit/${guestEdit.token}`)
                .field('content', '<p>Hallo</p><script>alert("xss")</script>');

            expect(res.statusCode).toBe(200);
            const updated = await Post.findById(post._id);
            expect(updated.content).not.toContain('<script');
            expect(updated.content).toContain('Hallo');
        });

        it('should ignore non-allowed fields like type', async () => {
            const post = await Post.create({
                title: 'Titel',
                slug: 'titel-2',
                type: 'pflanzung',
                published: true
            });
            const guestEdit = await GuestEdit.create({
                resource: 'posts',
                documentId: post._id,
                email: 'test@example.com',
                allowedFields: ['title']
            });

            await request(app)
                .put(`/api/v1/guest-edit/${guestEdit.token}`)
                .field('type', 'artikel');

            const updated = await Post.findById(post._id);
            expect(updated.type).toBe('pflanzung');
        });
    });
});
