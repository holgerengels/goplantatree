import { describe, it, expect } from 'vitest';
import { fillTemplate, formatters } from '../fillTemplate.js';

describe('fillTemplate', () => {
    it('replaces simple and nested placeholders', () => {
        expect(fillTemplate('{{name}} / {{ data.x }}', { name: 'Eiche', data: { x: 1 } }))
            .toBe('Eiche / 1');
    });

    it('renders missing / null values as empty string', () => {
        expect(fillTemplate('[{{a}}][{{b}}][{{c.d}}]', { b: null })).toBe('[][][]');
    });

    it('joins arrays', () => {
        expect(fillTemplate('{{tags}}', { tags: ['a', 'b'] })).toBe('a, b');
    });

    it('escapes HTML and macro brackets by default', () => {
        expect(fillTemplate('{{v}}', { v: '<b>"x"</b> [[posts]]' }))
            .toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt; &#91;&#91;posts&#93;&#93;');
    });

    it('keeps raw fields unescaped', () => {
        expect(fillTemplate('{{html}}', { html: '<p>Hi</p>' }, { rawFields: ['html'] }))
            .toBe('<p>Hi</p>');
    });

    it('does not escape when escape=false', () => {
        expect(fillTemplate('{{v}}', { v: 'A & B' }, { escape: false })).toBe('A & B');
    });

    it('applies formatters', () => {
        expect(fillTemplate('{{d|date}}', { d: '2026-05-07T10:00:00Z' }))
            .toBe(formatters.date('2026-05-07T10:00:00Z'));
        expect(fillTemplate('{{d|date}}', {})).toBe('');
    });

    it('unknown formatter yields empty string', () => {
        expect(fillTemplate('{{v|nope}}', { v: 'x' })).toBe('');
    });

    it('works inside macro props', () => {
        expect(fillTemplate('[[media id="{{image}}"]]', { image: 'img-1' }))
            .toBe('[[media id="img-1"]]');
    });
});
