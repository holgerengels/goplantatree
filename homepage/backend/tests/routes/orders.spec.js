import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import Order from '../../src/models/Order.js';
import Offering from '../../src/models/Offering.js';
import Project from '../../src/models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const generateToken = (permissions = {}) => {
    return jwt.sign({ id: 'user123', permissions }, JWT_SECRET);
};

describe('Orders API (Soft Refs + Denormalization)', () => {
    let originalFetch;
    beforeEach(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        await Project.create({ name: 'Test Project', slug: 'test-project', active: true });
        await Offering.create({
            name: 'Winterlinde', slug: 'winterlinde',
            project: 'test-project', category: 'Laubbaum',
            bezeichnungBotanisch: 'Tilia cordata', available: true
        });

        originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const parsedUrl = new URL(url, 'http://localhost');
            const q = parsedUrl.searchParams.get('q') || '';
            
            // Format can be: "Street HouseNumber, ZIP City" or "ZIP City"
            const parts = q.split(',');
            let streetPart = '';
            let zipCityPart = q;
            if (parts.length > 1) {
                streetPart = parts[0].trim();
                zipCityPart = parts[1].trim();
            }

            // Match 5 digit zip
            const zipMatch = zipCityPart.match(/\b\d{5}\b/);
            const zip = zipMatch ? zipMatch[0] : '89073';
            
            // Match city (everything after the zip)
            let city = 'Ulm';
            if (zipMatch) {
                const index = zipCityPart.indexOf(zip);
                city = zipCityPart.substring(index + zip.length).trim();
            }
            
            // Reconstruct road and house number from streetPart
            let road = '';
            let houseNumber = '';
            if (streetPart) {
                const spaceIndex = streetPart.lastIndexOf(' ');
                if (spaceIndex !== -1) {
                    road = streetPart.substring(0, spaceIndex).trim();
                    houseNumber = streetPart.substring(spaceIndex + 1).trim();
                } else {
                    road = streetPart;
                }
            }

            return {
                ok: true,
                json: async () => [{
                    place_id: 12345,
                    lat: '48.401',
                    lon: '9.987',
                    address: {
                        road: road || undefined,
                        house_number: houseNumber || undefined,
                        postcode: zip,
                        city: city || 'Ulm'
                    }
                }]
            };
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('POST /api/v1/orders (public, with offering denormalization)', () => {
        it('should create an order with project slug', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Max Mustermann',
                    email: 'max@example.com',
                    street: 'Musterstraße 1',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.orderNumber).toBeDefined();

            // Verify denormalized offering data in DB
            const order = await Order.findOne({ email: 'max@example.com' });
            expect(order).not.toBeNull();
            expect(order.project).toBe('test-project');
            expect(order.offering.slug).toBe('winterlinde');
            expect(order.offering.name).toBe('Winterlinde');
            expect(order.offering.category).toBe('Laubbaum');
            expect(order.offering.bezeichnungBotanisch).toBe('Tilia cordata');
        });

        it('should denormalize offering as snapshot (changing offering should NOT affect order)', async () => {
            // Create order
            await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Anna Snapshot',
                    email: 'anna@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            // Now change the offering name
            await Offering.findOneAndUpdate(
                { slug: 'winterlinde' },
                { name: 'Winterlinde UPDATED' }
            );

            // Order should still have the OLD name
            const order = await Order.findOne({ email: 'anna@test.de' });
            expect(order.offering.name).toBe('Winterlinde');
        });

        it('should handle non-existent offering slug gracefully', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'does-not-exist',
                    name: 'Ghost Order',
                    email: 'ghost@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            expect(res.statusCode).toBe(201);

            // Order should be created with a fallback offering
            const order = await Order.findOne({ email: 'ghost@test.de' });
            expect(order.offering.slug).toBe('does-not-exist');
            expect(order.offering.name).toBe('does-not-exist');
        });

        it('should create order without offering', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    name: 'No Offering',
                    email: 'no-offer@test.de',
                    street: 'Str 1', zip: '12345', city: 'Stadt',
                    quantity: 1, agb: true
                });

            expect(res.statusCode).toBe(201);
        });

        it('should fail validation for missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({ project: 'test-project' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Name ist ein Pflichtfeld');
        });
    });

    describe('Address Validation with Nominatim', () => {

        it('should allow order when Nominatim geocoding succeeds for normal address', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [{
                    place_id: 12345,
                    lat: '48.401',
                    lon: '9.987',
                    address: {
                        road: 'Musterstraße',
                        house_number: '1',
                        postcode: '89073',
                        city: 'Ulm'
                    }
                }]
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Max Validated',
                    email: 'maxval@example.com',
                    street: 'Musterstraße 1',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(201);
            expect(global.fetch).toHaveBeenCalled();
            
            const fetchUrl = global.fetch.mock.calls[0][0];
            expect(fetchUrl).toContain(encodeURIComponent('Musterstraße 1, 89073 Ulm'));
        });

        it('should block order and return 400 when geocoding fails for normal address', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => []
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Fake Address Guy',
                    email: 'fake@example.com',
                    street: 'Fantasystraße 999',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Die Adresse konnte nicht gefunden werden');
        });

        it('should block order and return 400 when postcode is structurally invalid', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Bad PLZ Guy',
                    email: 'badplz@example.com',
                    street: 'Ochsengasse 13',
                    zip: '890666',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Die Postleitzahl muss genau 5 Ziffern enthalten');
        });

        it('should block order and return 400 when email format is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Bad Email Guy',
                    email: 'invalid-email',
                    street: 'Ochsengasse 13',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Bitte gib eine gültige E-Mail-Adresse ein');
        });

        it('should return 400 and correction suggestion when postcode does not match location postcode', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [{
                    place_id: 12345,
                    address: {
                        road: 'Ochsengasse',
                        house_number: '13',
                        postcode: '89073',
                        city: 'Ulm'
                    }
                }]
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Mismatch PLZ Guy',
                    email: 'mismatch@example.com',
                    street: 'Ochsengasse 13',
                    zip: '89077',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Die eingegebene Adresse konnte nicht genau zugeordnet werden');
            expect(res.body.suggestion).toBeDefined();
            expect(res.body.suggestion.zip).toBe('89073');
            expect(res.body.suggestion.street).toBe('Ochsengasse 13');
            expect(res.body.suggestion.city).toBe('Ulm');
        });

        it('should return 400 and error message (no suggestion) when street cannot be found in the location', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [{
                    place_id: 12345,
                    address: {
                        postcode: '89073',
                        city: 'Ulm'
                    }
                }]
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Fake Street Guy',
                    email: 'fake@example.com',
                    street: 'Fantasystraße 999',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Die angegebene Straße konnte in diesem PLZ-Bereich nicht gefunden werden');
            expect(res.body.suggestion).toBeUndefined();
        });

        it('should return 400 and correction suggestion when street and city do not match postcode', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [{
                    place_id: 12345,
                    address: {
                        road: 'Ochsengasse',
                        house_number: '13',
                        postcode: '89073',
                        city: 'Ulm'
                    }
                }]
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Mismatch Zip City Guy',
                    email: 'mismatchzipcity@example.com',
                    street: 'Ochsengasse 13',
                    zip: '12345',
                    city: 'Berlin',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Die eingegebene Adresse konnte nicht genau zugeordnet werden');
            expect(res.body.suggestion).toBeDefined();
            expect(res.body.suggestion.zip).toBe('89073');
            expect(res.body.suggestion.city).toBe('Ulm');
            expect(res.body.suggestion.street).toBe('Ochsengasse 13');
        });

        it('should allow special address if Nominatim geocoding succeeds for just zip and city', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [{ place_id: 6789, lat: '48.401', lon: '9.987', address: { postcode: '89073' } }]
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'Max Schrebergärtner',
                    email: 'schreber@example.com',
                    street: 'Schrebergartenanlage Rißhalde, Parzelle 12',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: true
                });

            expect(res.statusCode).toBe(201);
            
            const fetchUrl = global.fetch.mock.calls[0][0];
            expect(fetchUrl).toContain(encodeURIComponent('89073 Ulm'));
            expect(fetchUrl).not.toContain(encodeURIComponent('Schrebergartenanlage'));
        });

        it('should fail-open (allow order) if Nominatim API is down or returns error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 503
            });

            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    project: 'test-project',
                    offering: 'winterlinde',
                    name: 'OSM Down Guy',
                    email: 'osmdown@example.com',
                    street: 'Musterstraße 2',
                    zip: '89073',
                    city: 'Ulm',
                    quantity: 1,
                    agb: true,
                    specialAddress: false
                });

            expect(res.statusCode).toBe(201);
        });
    });

    describe('GET /api/v1/orders (admin, slug filter)', () => {
        beforeEach(async () => {
            await Order.create({
                project: 'test-project',
                offering: { slug: 'winterlinde', name: 'Winterlinde', category: 'Laubbaum', bezeichnungBotanisch: 'Tilia cordata' },
                name: 'List Test', email: 'list@test.de',
                street: 'Str 1', zip: '12345', city: 'Stadt',
                quantity: 1, agb: true
            });
        });

        it('should deny access without token', async () => {
            const res = await request(app).get('/api/v1/orders');
            expect(res.statusCode).toBe(401);
        });

        it('should list orders with denormalized offering data', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].project).toBe('test-project');
            expect(res.body.items[0].offering.slug).toBe('winterlinde');
            expect(res.body.items[0].offering.name).toBe('Winterlinde');
        });

        it('should filter orders by project slug', async () => {
            await Order.create({
                project: 'other-project',
                orderNumber: 'GPT-2026-9999',
                name: 'Other', email: 'other@test.de',
                street: 'Str 2', zip: '54321', city: 'Anderswo',
                quantity: 1, agb: true
            });

            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders?project=test-project')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].project).toBe('test-project');
        });

        it('should deny export without token', async () => {
            const res = await request(app).get('/api/v1/orders/export');
            expect(res.statusCode).toBe(401);
        });

        it('should export orders as CSV with correct columns and data', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=csv')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.header['content-type']).toContain('text/csv');
            expect(res.header['content-disposition']).toContain('attachment; filename=orders_export.csv');
            
            // Should start with UTF-8 BOM \uFEFF
            expect(res.text.startsWith('\uFEFF')).toBe(true);
            
            // Header should contain fields configured in order.json's exportColumns
            expect(res.text).toContain('Nr.;Projekt;Name;E-Mail;Telefon;Straße;PLZ;Stadt;Baum;Anzahl;Zusatzoptionen;Pflanzort;Anmerkungen;Status;Datum');
            expect(res.text).toContain('List Test;list@test.de');
        });

        it('should export orders as ODS', async () => {
            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=ods')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.header['content-type']).toContain('application/vnd.oasis.opendocument.spreadsheet');
            expect(res.header['content-disposition']).toContain('attachment; filename=orders_export.ods');
            expect(res.body).toBeDefined();
        });

        it('should filter export by search query', async () => {
            await Order.create({
                project: 'test-project',
                orderNumber: 'GPT-2026-9999',
                name: 'Other Name', email: 'other@test.de',
                street: 'Str 2', zip: '54321', city: 'Anderswo',
                quantity: 1, agb: true
            });

            const token = generateToken({ orders: { read: 'all' } });
            const res = await request(app)
                .get('/api/v1/orders/export?format=csv&search=Other')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Other Name');
            expect(res.text).not.toContain('List Test');
        });
    });
});
