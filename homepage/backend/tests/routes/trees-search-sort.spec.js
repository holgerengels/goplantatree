import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Tree from '../../src/models/Tree.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Trees API — Server-side Search & Sort', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        // Create trees with diverse data for search/sort tests
        await Tree.create([
            { name: 'Eiche', slug: 'eiche', category: 'Laubbaum', height: '20-30 m', width: '15-20 m', growthForm: 'Breitkronig / Ausladend' },
            { name: 'Birke', slug: 'birke', category: 'Laubbaum', height: '15-25 m', width: '8-12 m', growthForm: 'Eiförmig / Oval' },
            { name: 'Fichte', slug: 'fichte', category: 'Nadelbaum', height: '30-50 m', width: '6-8 m', growthForm: 'Pyramidal / Kegelförmig' },
            { name: 'Kornelkirsche', slug: 'kornelkirsche', category: 'Großstrauch', height: '4-8 m', width: '3-5 m', growthForm: 'Strauchartig / Mehrstämmig' },
            { name: 'Amberbaum', slug: 'amberbaum-slender', category: 'Laubbaum', height: '10-15 m', width: '3-4 m', growthForm: 'Säulenförmig (schlank, aufrecht)' },
        ]);
    });

    describe('GET /api/v1/trees?search=', () => {
        it('should find trees by name', async () => {
            const res = await request(app).get('/api/v1/trees?search=eiche');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Eiche');
        });

        it('should find trees by slug', async () => {
            const res = await request(app).get('/api/v1/trees?search=amberbaum-slender');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Amberbaum');
        });

        it('should find trees by partial slug match', async () => {
            const res = await request(app).get('/api/v1/trees?search=kornelkirsche');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].slug).toBe('kornelkirsche');
        });

        it('should find trees by category', async () => {
            const res = await request(app).get('/api/v1/trees?search=nadelbaum');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Fichte');
        });

        it('should find trees by growthForm', async () => {
            const res = await request(app).get('/api/v1/trees?search=Säulenförmig');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Amberbaum');
        });

        it('should be case-insensitive', async () => {
            const res = await request(app).get('/api/v1/trees?search=BIRKE');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Birke');
        });

        it('should return empty for non-matching search', async () => {
            const res = await request(app).get('/api/v1/trees?search=palme');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(0);
        });

        it('should return all trees without search param', async () => {
            const res = await request(app).get('/api/v1/trees');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(5);
        });
    });

    describe('GET /api/v1/trees?sort=&sortDir=', () => {
        it('should sort by name ascending', async () => {
            const res = await request(app).get('/api/v1/trees?sort=name&sortDir=asc');
            expect(res.statusCode).toBe(200);
            const names = res.body.map(t => t.name);
            expect(names).toEqual(['Amberbaum', 'Birke', 'Eiche', 'Fichte', 'Kornelkirsche']);
        });

        it('should sort by name descending', async () => {
            const res = await request(app).get('/api/v1/trees?sort=name&sortDir=desc');
            expect(res.statusCode).toBe(200);
            const names = res.body.map(t => t.name);
            expect(names).toEqual(['Kornelkirsche', 'Fichte', 'Eiche', 'Birke', 'Amberbaum']);
        });

        it('should sort by category', async () => {
            const res = await request(app).get('/api/v1/trees?sort=category&sortDir=asc');
            expect(res.statusCode).toBe(200);
            const categories = res.body.map(t => t.category);
            expect(categories[0]).toBe('Großstrauch');
            expect(categories[categories.length - 1]).toBe('Nadelbaum');
        });

        it('should sort by slug', async () => {
            const res = await request(app).get('/api/v1/trees?sort=slug&sortDir=asc');
            expect(res.statusCode).toBe(200);
            const slugs = res.body.map(t => t.slug);
            expect(slugs).toEqual(['amberbaum-slender', 'birke', 'eiche', 'fichte', 'kornelkirsche']);
        });
    });

    describe('GET /api/v1/trees?search=&sort=&sortDir= (combined)', () => {
        it('should search and sort results', async () => {
            const res = await request(app).get('/api/v1/trees?search=Laubbaum&sort=name&sortDir=desc');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(3);
            const names = res.body.map(t => t.name);
            expect(names).toEqual(['Eiche', 'Birke', 'Amberbaum']);
        });
    });
});
