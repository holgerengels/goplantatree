import { describe, it, expect } from 'vitest';
import { renderTemplate, hasUnsubscribeLink, buildSubscriberVariables } from '../../src/utils/mailTemplateEngine.js';

describe('mailTemplateEngine', () => {

    describe('renderTemplate', () => {
        it('should replace simple placeholders', () => {
            const result = renderTemplate('Hallo {{name}}!', { name: 'Max' });
            expect(result).toBe('Hallo Max!');
        });

        it('should replace multiple placeholders', () => {
            const result = renderTemplate('{{name}} ({{email}})', { name: 'Max', email: 'max@test.com' });
            expect(result).toBe('Max (max@test.com)');
        });

        it('should handle nested data access', () => {
            const result = renderTemplate('Bestellung {{data.orderNumber}}', {
                data: { orderNumber: 'GPT-2026-0001' }
            });
            expect(result).toBe('Bestellung GPT-2026-0001');
        });

        it('should handle deeply nested access', () => {
            const result = renderTemplate('{{data.address.city}}', {
                data: { address: { city: 'Ulm' } }
            });
            expect(result).toBe('Ulm');
        });

        it('should replace missing variables with empty string', () => {
            const result = renderTemplate('Hello {{missing}}!', {});
            expect(result).toBe('Hello !');
        });

        it('should handle whitespace in placeholders', () => {
            const result = renderTemplate('{{ name }}', { name: 'Test' });
            expect(result).toBe('Test');
        });

        it('should handle null/undefined values', () => {
            const result = renderTemplate('{{val}}', { val: null });
            expect(result).toBe('');
        });

        it('should convert numbers to string', () => {
            const result = renderTemplate('{{data.count}} Bäume', { data: { count: 42 } });
            expect(result).toBe('42 Bäume');
        });

        it('should return empty string for null template', () => {
            expect(renderTemplate(null, {})).toBe('');
            expect(renderTemplate(undefined, {})).toBe('');
        });

        it('should not replace non-matching patterns', () => {
            const result = renderTemplate('text {notAPlaceholder} end', {});
            expect(result).toBe('text {notAPlaceholder} end');
        });
    });

    describe('hasUnsubscribeLink', () => {
        it('should detect {{unsubscribe_url}}', () => {
            expect(hasUnsubscribeLink('<a href="{{unsubscribe_url}}">Abmelden</a>')).toBe(true);
        });

        it('should detect with whitespace', () => {
            expect(hasUnsubscribeLink('{{ unsubscribe_url }}')).toBe(true);
        });

        it('should return false when missing', () => {
            expect(hasUnsubscribeLink('<p>No link here</p>')).toBe(false);
        });

        it('should return false for null/empty', () => {
            expect(hasUnsubscribeLink(null)).toBe(false);
            expect(hasUnsubscribeLink('')).toBe(false);
        });
    });

    describe('buildSubscriberVariables', () => {
        it('should build variables from subscriber', () => {
            const sub = {
                name: 'Max',
                email: 'max@test.com',
                project: 'test-project',
                topic: 'general',
                confirmToken: 'abc123',
                data: { orderNumber: 'GPT-001' }
            };

            const vars = buildSubscriberVariables(sub, 'https://example.com');
            expect(vars.name).toBe('Max');
            expect(vars.email).toBe('max@test.com');
            expect(vars.project).toBe('test-project');
            expect(vars.topic).toBe('general');
            expect(vars.unsubscribe_url).toBe('https://example.com/abmelden/abc123');
            expect(vars.data.orderNumber).toBe('GPT-001');
        });

        it('should handle missing fields gracefully', () => {
            const sub = { email: 'min@test.com', confirmToken: 'xyz' };
            const vars = buildSubscriberVariables(sub, 'https://example.com/');
            expect(vars.name).toBe('');
            expect(vars.project).toBe('');
            expect(vars.unsubscribe_url).toBe('https://example.com/abmelden/xyz');
        });
    });
});
