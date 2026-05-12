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
