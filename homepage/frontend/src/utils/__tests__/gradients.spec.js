import { describe, it, expect } from 'vitest';
import { getCategoryGradient, categoryGradients, defaultGradient } from '../gradients.js';

describe('gradients utility', () => {
    it('should return correct gradient for known categories', () => {
        expect(getCategoryGradient('Laubbaum')).toContain('#4CAF50');
        expect(getCategoryGradient('Obstbaum')).toContain('#FF9800');
        expect(getCategoryGradient('Nadelbaum')).toContain('#558B2F');
        expect(getCategoryGradient('Großstrauch')).toContain('#26A69A');
        expect(getCategoryGradient('Strauch')).toContain('#66BB6A');
    });

    it('should return default gradient for unknown category', () => {
        expect(getCategoryGradient('Unknown')).toBe(defaultGradient);
        expect(getCategoryGradient('')).toBe(defaultGradient);
        expect(getCategoryGradient(undefined)).toBe(defaultGradient);
    });

    it('should return gradient for post types', () => {
        expect(getCategoryGradient('news')).toContain('#2E5641');
        expect(getCategoryGradient('pflanzung')).toContain('#A3DE74');
    });

    it('should export a complete categoryGradients map', () => {
        expect(Object.keys(categoryGradients).length).toBeGreaterThanOrEqual(7);
        for (const gradient of Object.values(categoryGradients)) {
            expect(gradient).toMatch(/^linear-gradient/);
        }
    });
});
