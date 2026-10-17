import { describe, it, expect, vi } from 'vitest';
import { applyMergeStrategies } from '../../src/utils/crudFactory.js';

describe('applyMergeStrategies', () => {
    describe('union', () => {
        it('adds new values and keeps existing ones', () => {
            const doc = { topics: ['general'] };
            const changed = applyMergeStrategies(doc, { topics: ['general', 'klimabaumaktion'] }, { topics: 'union' });
            expect(changed).toBe(true);
            expect(doc.topics).toEqual(['general', 'klimabaumaktion']);
        });

        it('reports no change when all values already present', () => {
            const doc = { topics: ['general', 'pflanzung'] };
            expect(applyMergeStrategies(doc, { topics: ['pflanzung'] }, { topics: 'union' })).toBe(false);
            expect(doc.topics).toEqual(['general', 'pflanzung']);
        });

        it('accepts a scalar and ignores blank values', () => {
            const doc = { topics: [] };
            applyMergeStrategies(doc, { topics: 'news' }, { topics: 'union' });
            applyMergeStrategies(doc, { topics: ['', null] }, { topics: 'union' });
            expect(doc.topics).toEqual(['news']);
        });
    });

    describe('setIfEmpty', () => {
        it('fills an empty field', () => {
            const doc = { name: '' };
            expect(applyMergeStrategies(doc, { name: 'Neu' }, { name: 'setIfEmpty' })).toBe(true);
            expect(doc.name).toBe('Neu');
        });

        it('treats undefined, null and [] as empty', () => {
            const doc = { a: undefined, b: null, c: [] };
            applyMergeStrategies(doc, { a: 1, b: 2, c: ['x'] }, { a: 'setIfEmpty', b: 'setIfEmpty', c: 'setIfEmpty' });
            expect(doc).toEqual({ a: 1, b: 2, c: ['x'] });
        });

        it('does not touch an existing value', () => {
            const doc = { name: 'Alt' };
            expect(applyMergeStrategies(doc, { name: 'Neu' }, { name: 'setIfEmpty' })).toBe(false);
            expect(doc.name).toBe('Alt');
        });

        it('supports alias "fill"', () => {
            const doc = {};
            applyMergeStrategies(doc, { name: 'Neu' }, { name: 'fill' });
            expect(doc.name).toBe('Neu');
        });
    });

    describe('overwrite', () => {
        it('replaces a different value', () => {
            const doc = { name: 'Alt' };
            expect(applyMergeStrategies(doc, { name: 'Neu' }, { name: 'overwrite' })).toBe(true);
            expect(doc.name).toBe('Neu');
        });

        it('reports no change for identical value', () => {
            const doc = { name: 'Gleich' };
            expect(applyMergeStrategies(doc, { name: 'Gleich' }, { name: 'overwrite' })).toBe(false);
        });

        it('never overwrites with a blank value', () => {
            const doc = { name: 'Alt' };
            expect(applyMergeStrategies(doc, { name: '' }, { name: 'overwrite' })).toBe(false);
            expect(doc.name).toBe('Alt');
        });
    });

    describe('merge', () => {
        it('keeps existing keys, adds new ones and updates changed ones', () => {
            const doc = { data: { tree: 'Eiche', slot: '10:00' } };
            const changed = applyMergeStrategies(
                doc,
                { data: { slot: '11:00', orderNumber: 'ORD-1' } },
                { data: 'merge' }
            );
            expect(changed).toBe(true);
            expect(doc.data).toEqual({ tree: 'Eiche', slot: '11:00', orderNumber: 'ORD-1' });
        });

        it('creates the object if missing', () => {
            const doc = {};
            applyMergeStrategies(doc, { data: { a: 1 } }, { data: 'merge' });
            expect(doc.data).toEqual({ a: 1 });
        });

        it('reports no change when all keys identical', () => {
            const doc = { data: { a: 1, b: [1, 2] } };
            expect(applyMergeStrategies(doc, { data: { b: [1, 2] } }, { data: 'merge' })).toBe(false);
        });
    });

    describe('general', () => {
        it('skips fields not present in the row', () => {
            const doc = { name: 'Alt', topics: ['general'] };
            expect(applyMergeStrategies(doc, {}, { name: 'overwrite', topics: 'union' })).toBe(false);
            expect(doc).toEqual({ name: 'Alt', topics: ['general'] });
        });

        it('ignores fields without a strategy and unknown strategies', () => {
            const doc = { name: 'Alt', email: 'a@b.de' };
            expect(applyMergeStrategies(doc, { name: 'Neu', email: 'x@y.de' }, { name: 'bogus' })).toBe(false);
            expect(doc).toEqual({ name: 'Alt', email: 'a@b.de' });
        });

        it('calls markModified for array and object fields (Mongoose Mixed/Array)', () => {
            const doc = { topics: [], data: {}, markModified: vi.fn() };
            applyMergeStrategies(doc, { topics: ['x'], data: { a: 1 } }, { topics: 'union', data: 'merge' });
            expect(doc.markModified).toHaveBeenCalledWith('topics');
            expect(doc.markModified).toHaveBeenCalledWith('data');
        });
    });
});
