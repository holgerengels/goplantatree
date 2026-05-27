import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import User from '../../src/models/User.js';
import PermissionProfile from '../../src/models/PermissionProfile.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Auth API', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    describe('POST /api/v1/auth/login', () => {
        it('should return 400 if username or password is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'admin' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('erforderlich');
        });

        it('should return 401 for non-existent user', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'nobody', password: 'secret' });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toContain('Ungültige');
        });

        it('should return 401 for wrong password', async () => {
            const user = new User({ username: 'testuser', email: 'test@test.com', passwordHash: 'correctpass' });
            await user.save();

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'testuser', password: 'wrongpass' });

            expect(res.statusCode).toBe(401);
        });

        it('should return token on successful login', async () => {
            const user = new User({ username: 'admin', email: 'admin@test.com', passwordHash: 'testpassword' });
            await user.save();

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'admin', password: 'testpassword' });

            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.user).toBeDefined();
            expect(res.body.user.passwordHash).toBeUndefined(); // should not leak
        });

        it('should include permissions from profile', async () => {
            const profile = await PermissionProfile.create({
                name: 'Admin',
                permissions: [{ resource: 'orders', read: 'all', create: 'all', update: 'all', delete: 'all' }]
            });

            const user = new User({
                username: 'profiled',
                email: 'p@test.com',
                passwordHash: 'mypass',
                profile: profile._id
            });
            await user.save();

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'profiled', password: 'mypass' });

            expect(res.statusCode).toBe(200);
            expect(res.body.permissions).toBeDefined();
            expect(res.body.permissions.orders).toBeDefined();
            expect(res.body.permissions.orders.read).toBe('all');
        });

        it('should merge permissions from multiple profiles correctly (highest wins: all > own > none)', async () => {
            const profile1 = await PermissionProfile.create({
                name: 'Reader',
                permissions: [
                    { resource: 'orders', read: 'own', create: 'none', update: 'none', delete: 'none' },
                    { resource: 'users', read: 'all', create: 'none', update: 'none', delete: 'none' }
                ]
            });

            const profile2 = await PermissionProfile.create({
                name: 'Editor',
                permissions: [
                    { resource: 'orders', read: 'all', create: 'own', update: 'own', delete: 'none' }
                ]
            });

            const user = new User({
                username: 'multiprofiled',
                email: 'mp@test.com',
                passwordHash: 'mypass',
                profiles: [profile1._id, profile2._id]
            });
            await user.save();

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'multiprofiled', password: 'mypass' });

            expect(res.statusCode).toBe(200);
            expect(res.body.permissions).toBeDefined();
            
            // For orders: read should merge to 'all' (profile2 'all' > profile1 'own')
            // create should merge to 'own' (profile2 'own' > profile1 'none')
            // update should merge to 'own' (profile2 'own' > profile1 'none')
            // delete should remain 'none'
            expect(res.body.permissions.orders).toBeDefined();
            expect(res.body.permissions.orders.read).toBe('all');
            expect(res.body.permissions.orders.create).toBe('own');
            expect(res.body.permissions.orders.update).toBe('own');
            expect(res.body.permissions.orders.delete).toBe('none');

            // For users: read should be 'all' (profile1 'all')
            expect(res.body.permissions.users).toBeDefined();
            expect(res.body.permissions.users.read).toBe('all');
            expect(res.body.permissions.users.create).toBe('none');
        });
    });

    describe('GET /api/v1/auth/me', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/v1/auth/me');
            expect(res.statusCode).toBe(401);
        });

        it('should return user data with valid token', async () => {
            const user = new User({ username: 'meuser', email: 'me@test.com', passwordHash: 'pass123' });
            await user.save();

            // Login to get a real token
            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({ username: 'meuser', password: 'pass123' });

            const res = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${loginRes.body.token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('meuser');
            expect(res.body.passwordHash).toBeUndefined();
        });
    });
});
