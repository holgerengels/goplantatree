import { describe, it, expect } from 'vitest';
import { resolveMailAccount } from '../../src/utils/mailService.js';

describe('mailService.js', () => {
    describe('resolveMailAccount', () => {
        it('returns exact match account if found', () => {
            expect(resolveMailAccount('klimabaumaktion-ulm')).toBe('klimabaumaktion-ulm');
            expect(resolveMailAccount('100-baeume-bc')).toBe('100-baeume-bc');
            expect(resolveMailAccount('info')).toBe('info');
        });

        it('throws for unknown project slug', () => {
            expect(() => resolveMailAccount('unknown-project')).toThrow(/No mail account configured/);
        });

        it('throws for empty or null slug', () => {
            expect(() => resolveMailAccount('')).toThrow();
            expect(() => resolveMailAccount(null)).toThrow();
            expect(() => resolveMailAccount(undefined)).toThrow();
        });
    });
});
