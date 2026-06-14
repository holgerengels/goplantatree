import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import MailTemplate from '../../src/models/MailTemplate.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

const adminToken = () => generateToken({ mail: { read: 'all', create: 'all', update: 'all', delete: 'all' } });

describe('Mail Templates API', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('POST /api/v1/mail-templates', () => {
        it('should create a mail template', async () => {
            const token = adminToken();
            const res = await request(app)
                .post('/api/v1/mail-templates')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    slug: 'newsletter',
                    name: 'Newsletter Standard',
                    type: 'newsletter',
                    project: 'klimabaumaktion-ulm',
                    subject: '🌳 Neues von {{project}}',
                    html: '<p>Hallo {{name}}</p><p><a href="{{unsubscribe_url}}">Abmelden</a></p>',
                    variables: ['name', 'email', 'unsubscribe_url'],
                    active: true
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.slug).toBe('newsletter');
            expect(res.body.project).toBe('klimabaumaktion-ulm');
            expect(res.body.type).toBe('newsletter');
            expect(res.body.variables).toContain('name');
        });

        it('should reject invalid type', async () => {
            const token = adminToken();
            const res = await request(app)
                .post('/api/v1/mail-templates')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    slug: 'invalid',
                    name: 'Invalid',
                    type: 'invalid-type',
                    subject: 'test',
                    html: '<p>test</p>'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should enforce unique slug+project', async () => {
            const token = adminToken();
            const payload = {
                slug: 'subscribe-confirm',
                name: 'Bestätigung',
                type: 'transactional',
                project: 'test-project',
                subject: 'Bestätige',
                html: '<p>Bestätige: {{confirm_url}}</p>'
            };

            await request(app).post('/api/v1/mail-templates').set('Authorization', `Bearer ${token}`).send(payload);
            const res = await request(app).post('/api/v1/mail-templates').set('Authorization', `Bearer ${token}`).send(payload);

            expect(res.statusCode).toBe(409);
        });

        it('should allow same slug for different projects', async () => {
            const token = adminToken();
            const base = {
                slug: 'subscribe-confirm',
                name: 'Bestätigung',
                type: 'transactional',
                subject: 'Bestätige',
                html: '<p>{{confirm_url}}</p>'
            };

            const res1 = await request(app).post('/api/v1/mail-templates').set('Authorization', `Bearer ${token}`)
                .send({ ...base, project: 'project-a' });
            const res2 = await request(app).post('/api/v1/mail-templates').set('Authorization', `Bearer ${token}`)
                .send({ ...base, project: 'project-b' });

            expect(res1.statusCode).toBe(201);
            expect(res2.statusCode).toBe(201);
        });
    });

    describe('GET /api/v1/mail-templates', () => {
        beforeEach(async () => {
            await MailTemplate.create([
                { slug: 'newsletter', name: 'NL A', type: 'newsletter', project: 'project-a', subject: 'Neues', html: '<p>A</p>', active: true },
                { slug: 'newsletter', name: 'NL B', type: 'newsletter', project: 'project-b', subject: 'Neues', html: '<p>B</p>', active: true },
                { slug: 'subscribe-confirm', name: 'Bestätigung', type: 'transactional', project: 'project-a', subject: 'Bestätige', html: '<p>C</p>', active: true },
                { slug: 'inactive', name: 'Inaktiv', type: 'newsletter', project: 'project-a', subject: 'X', html: '<p>X</p>', active: false }
            ]);
        });

        it('should list all templates for admin', async () => {
            const token = adminToken();
            const res = await request(app).get('/api/v1/mail-templates').set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(4);
        });

        it('should filter by type', async () => {
            const token = adminToken();
            const res = await request(app).get('/api/v1/mail-templates?type=transactional').set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].slug).toBe('subscribe-confirm');
        });

        it('should filter by project', async () => {
            const token = adminToken();
            const res = await request(app).get('/api/v1/mail-templates?project=project-a').set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(3);
        });

        it('should filter by active status', async () => {
            const token = adminToken();
            const res = await request(app).get('/api/v1/mail-templates?active=false').set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].slug).toBe('inactive');
        });

        it('should require authentication', async () => {
            const res = await request(app).get('/api/v1/mail-templates');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('PUT /api/v1/mail-templates/:id', () => {
        it('should update a template', async () => {
            const tpl = await MailTemplate.create({
                slug: 'newsletter', name: 'Old Name', type: 'newsletter',
                project: 'p', subject: 'Old', html: '<p>Old</p>'
            });

            const token = adminToken();
            const res = await request(app)
                .put(`/api/v1/mail-templates/${tpl._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Name', subject: 'New Subject' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('New Name');
            expect(res.body.subject).toBe('New Subject');
        });
    });

    describe('DELETE /api/v1/mail-templates/:id', () => {
        it('should delete a template', async () => {
            const tpl = await MailTemplate.create({
                slug: 'to-delete', name: 'Delete Me', type: 'newsletter',
                project: 'p', subject: 'X', html: '<p>X</p>'
            });

            const token = adminToken();
            const res = await request(app)
                .delete(`/api/v1/mail-templates/${tpl._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(await MailTemplate.findById(tpl._id)).toBeNull();
        });
    });

    describe('GET /api/v1/mail-templates/:slug (by slug)', () => {
        it('should get template by slug', async () => {
            await MailTemplate.create({
                slug: 'newsletter', name: 'NL', type: 'newsletter',
                project: 'p', subject: 'S', html: '<p>H</p>'
            });

            const token = adminToken();
            const res = await request(app)
                .get('/api/v1/mail-templates/newsletter')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.slug).toBe('newsletter');
        });
    });
});
