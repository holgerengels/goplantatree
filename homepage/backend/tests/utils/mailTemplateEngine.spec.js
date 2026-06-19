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

        it('should return null for null values (single expression)', () => {
            const result = renderTemplate('{{val}}', { val: null });
            expect(result).toBe(null);
        });

        it('should replace null values with empty string in interpolation', () => {
            const result = renderTemplate('Wert: {{val}}', { val: null });
            expect(result).toBe('Wert: ');
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

    describe('renderTemplate expressions', () => {
        it('should evaluate ternary expressions', () => {
            const result = renderTemplate('{{data.selectedAddons ? "inklusive Wühlmauskorb" : ""}}', {
                data: { selectedAddons: true }
            });
            expect(result).toBe('inklusive Wühlmauskorb');
        });

        it('should evaluate ternary to empty string when falsy', () => {
            const result = renderTemplate('{{data.selectedAddons ? "inklusive Wühlmauskorb" : ""}}', {
                data: { selectedAddons: false }
            });
            expect(result).toBe('');
        });

        it('should evaluate ternary in surrounding text', () => {
            const result = renderTemplate('Bestellung {{data.count > 1 ? "viele" : "eins"}}', {
                data: { count: 5 }
            });
            expect(result).toBe('Bestellung viele');
        });

        it('should evaluate boolean comparisons', () => {
            const result = renderTemplate('{{data.type === "premium"}}', {
                data: { type: 'premium' }
            });
            expect(result).toBe(true);
        });

        it('should evaluate && and || operators', () => {
            expect(renderTemplate('{{data.a && data.b}}', { data: { a: true, b: true } })).toBe(true);
            expect(renderTemplate('{{data.a && data.b}}', { data: { a: true, b: false } })).toBe(false);
            expect(renderTemplate('{{data.a || data.b}}', { data: { a: false, b: true } })).toBe(true);
        });

        it('should evaluate string method calls', () => {
            const result = renderTemplate('{{data.name.toUpperCase()}}', {
                data: { name: 'max' }
            });
            expect(result).toBe('MAX');
        });

        it('should handle mixed text with expressions', () => {
            const result = renderTemplate(
                'Hallo {{name}}, du hast {{data.count}} Bäume bestellt{{data.addon ? " mit Korb" : ""}}.',
                { name: 'Max', data: { count: 3, addon: true } }
            );
            expect(result).toBe('Hallo Max, du hast 3 Bäume bestellt mit Korb.');
        });

        it('should return original string on syntax error (single expression)', () => {
            const expr = '{{ invalid &&& syntax }}';
            expect(renderTemplate(expr, {})).toBe(expr);
        });

        it('should return empty string on error in interpolation mode', () => {
            const result = renderTemplate('Start {{ invalid &&& }} End', {});
            expect(result).toBe('Start  End');
        });

        it('should handle arithmetic expressions', () => {
            const result = renderTemplate('{{data.price * data.count}}', {
                data: { price: 25, count: 3 }
            });
            expect(result).toBe(75);
        });

        it('should handle arithmetic in interpolation', () => {
            const result = renderTemplate('Gesamt: {{data.price * data.count}} €', {
                data: { price: 25, count: 3 }
            });
            expect(result).toBe('Gesamt: 75 €');
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
                topics: ['general', 'klimabaumaktion'],
                confirmToken: 'abc123',
                data: { orderNumber: 'GPT-001' }
            };

            const vars = buildSubscriberVariables(sub, 'https://example.com');
            expect(vars.name).toBe('Max');
            expect(vars.email).toBe('max@test.com');
            expect(vars.project).toBe('test-project');
            expect(vars.topics).toEqual(['general', 'klimabaumaktion']);
            expect(vars.topic).toBe('general, klimabaumaktion');
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
