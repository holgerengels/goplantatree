import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { auth, requirePermission, optionalAuth } from '../../src/middleware/auth.js';

describe('Auth Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        process.env.JWT_SECRET = 'test-secret';
        req = { headers: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('auth()', () => {
        it('should return 401 if no authorization header is present', () => {
            auth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Nicht authentifiziert' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 if authorization header does not start with Bearer', () => {
            req.headers.authorization = 'Basic dXNlcjpwYXNz';
            auth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Nicht authentifiziert' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 if token is invalid', () => {
            req.headers.authorization = 'Bearer invalid.token.here';
            auth(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Ungültiger Token' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next() and attach user if token is valid', () => {
            const userData = { id: '123', email: 'test@example.com' };
            const token = jwt.sign(userData, process.env.JWT_SECRET);
            req.headers.authorization = `Bearer ${token}`;

            auth(req, res, next);
            
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(userData.id);
            expect(req.user.email).toBe(userData.email);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('requirePermission()', () => {
        it('should return 403 if req.user is missing', () => {
            const middleware = requirePermission('orders', 'read');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Keine Berechtigung (Kein Profil)' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 if user lacks permission for the specific resource', () => {
            req.user = { permissions: { posts: { read: 'all' } } };
            const middleware = requirePermission('orders', 'read');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Keine Berechtigung für orders' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 if user lacks specific action on the resource', () => {
            req.user = { permissions: { orders: { read: 'none' } } };
            const middleware = requirePermission('orders', 'read');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Aktion read auf orders verweigert' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next() and attach scope if user has valid permission', () => {
            req.user = { permissions: { orders: { read: 'all' } } };
            const middleware = requirePermission('orders', 'read');
            middleware(req, res, next);

            expect(req.permissionScope).toBe('all');
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('optionalAuth()', () => {
        it('should call next() without user if no header is present', () => {
            optionalAuth(req, res, next);
            expect(req.user).toBeUndefined();
            expect(next).toHaveBeenCalled();
        });

        it('should call next() without user if token is invalid', () => {
            req.headers.authorization = 'Bearer invalid-token';
            optionalAuth(req, res, next);
            expect(req.user).toBeUndefined();
            expect(next).toHaveBeenCalled();
        });

        it('should call next() and attach user if token is valid', () => {
            const userData = { id: '456' };
            const token = jwt.sign(userData, process.env.JWT_SECRET);
            req.headers.authorization = `Bearer ${token}`;

            optionalAuth(req, res, next);
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(userData.id);
            expect(next).toHaveBeenCalled();
        });
    });
});
