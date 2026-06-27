import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../src/utils/crudFactory.js';

describe('computeDiff', () => {
    it('should return null if before is null', () => {
        expect(computeDiff(null, { name: 'test' })).toBeNull();
    });

    it('should return null if after is null', () => {
        expect(computeDiff({ name: 'test' }, null)).toBeNull();
    });

    it('should return null if no changes', () => {
        const obj = { name: 'test', status: 'neu' };
        expect(computeDiff(obj, { ...obj })).toBeNull();
    });

    it('should detect changed fields', () => {
        const before = { name: 'Max', status: 'neu', email: 'a@b.de' };
        const after = { name: 'Max', status: 'bestätigt', email: 'a@b.de' };
        const diff = computeDiff(before, after);

        expect(diff).toEqual({
            status: { from: 'neu', to: 'bestätigt' }
        });
    });

    it('should detect added fields', () => {
        const before = { name: 'Max' };
        const after = { name: 'Max', phone: '0731-123' };
        const diff = computeDiff(before, after);

        expect(diff).toEqual({
            phone: { from: null, to: '0731-123' }
        });
    });

    it('should detect removed fields', () => {
        const before = { name: 'Max', phone: '0731-123' };
        const after = { name: 'Max' };
        const diff = computeDiff(before, after);

        expect(diff).toEqual({
            phone: { from: '0731-123', to: null }
        });
    });

    it('should skip _id and __v', () => {
        const before = { _id: '123', __v: 0, name: 'Max' };
        const after = { _id: '456', __v: 1, name: 'Max' };
        expect(computeDiff(before, after)).toBeNull();
    });

    it('should skip sanitized keys (passwordHash, data)', () => {
        const before = { passwordHash: 'old', data: Buffer.from('old'), name: 'Max' };
        const after = { passwordHash: 'new', data: Buffer.from('new'), name: 'Max' };
        expect(computeDiff(before, after)).toBeNull();
    });

    it('should detect nested object changes', () => {
        const before = { offering: { slug: 'a', name: 'Linde' } };
        const after = { offering: { slug: 'a', name: 'Eiche' } };
        const diff = computeDiff(before, after);

        expect(diff).toBeDefined();
        expect(diff.offering.from.name).toBe('Linde');
        expect(diff.offering.to.name).toBe('Eiche');
    });
});
