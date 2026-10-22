import { formatDateLong } from './format.js';

/**
 * Template filling for entity detail pages (Page "detail-<entity-slug>").
 *
 * Syntax:  {{field}}  {{data.sub}}  {{field|formatter}}
 *
 * - Values are HTML-escaped (incl. "[" so item data can't inject [[macros]]),
 *   except fields listed in `rawFields` (RichText from the admin) without formatter.
 * - Missing / null values → empty string. Arrays → "a, b, c".
 * - Unknown formatter → empty string.
 */

/** Registry of formatters — extend here. */
export const formatters = {
    date: (v) => (v ? formatDateLong(v) : '')
};

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g;

export const escapeHtml = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;');

export const getPath = (obj, path) =>
    path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * @param {String} str        Template string
 * @param {Object} item       Entity data
 * @param {Object} [options]
 * @param {String[]} [options.rawFields]  Fields inserted without escaping (RichText)
 * @param {Boolean} [options.escape=true] false for plain-text targets (title, hero subtitle)
 */
export function fillTemplate(str, item, { rawFields = [], escape = true } = {}) {
    if (!str) return str || '';
    return str.replace(PLACEHOLDER, (_match, path, fmt) => {
        let val = getPath(item, path);
        if (fmt) {
            const formatter = formatters[fmt];
            val = formatter ? formatter(val) : '';
        }
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) val = val.join(', ');
        val = String(val);
        if (!escape || (!fmt && rawFields.includes(path))) return val;
        return escapeHtml(val);
    });
}
