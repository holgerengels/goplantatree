import { describe, it, expect } from 'vitest';
import { formatDate, formatDateLong, formatDateTime } from '../format.js';

describe('Format Utilities', () => {
    describe('formatDate', () => {
        it('should format a valid date correctly', () => {
            const date = new Date('2024-05-15T12:00:00Z');
            // format depends on timezone, but let's check for standard de-DE output
            expect(formatDate(date)).toContain('15.5.2024');
        });

        it('should format a valid ISO string correctly', () => {
            expect(formatDate('2024-05-15T12:00:00Z')).toContain('15.5.2024');
        });

        it('should handle falsy values by returning an empty string', () => {
            expect(formatDate(null)).toBe('');
            expect(formatDate(undefined)).toBe('');
            expect(formatDate('')).toBe('');
        });
    });

    describe('formatDateLong (deprecated alias)', () => {
        it('should behave identically to formatDate', () => {
            const date = new Date('2024-05-15T12:00:00Z');
            expect(formatDateLong(date)).toBe(formatDate(date));
        });

        it('should handle falsy values by returning an empty string', () => {
            expect(formatDateLong(null)).toBe('');
        });
    });

    describe('formatDateTime', () => {
        it('should include date and time', () => {
            const date = new Date('2024-05-15T14:30:00Z');
            const result = formatDateTime(date);
            // Should contain date parts and time
            expect(result).toContain('15.05.2024');
            expect(result).toMatch(/\d{2}:\d{2}/);
        });

        it('should handle falsy values by returning an empty string', () => {
            expect(formatDateTime(null)).toBe('');
            expect(formatDateTime(undefined)).toBe('');
            expect(formatDateTime('')).toBe('');
        });
    });
});
