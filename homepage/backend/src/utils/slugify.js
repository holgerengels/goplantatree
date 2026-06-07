/**
 * Converts a string into a URL-safe slug.
 * Rules: lowercase, a-z 0-9 and hyphens only.
 * German umlauts are transliterated (ä→ae, ö→oe, ü→ue, ß→ss).
 *
 * @param {string} str - The input string
 * @returns {string} The slugified string
 */
export function slugify(str) {
    if (!str) return '';
    return str
        .replace(/ä/gi, 'ae')
        .replace(/ö/gi, 'oe')
        .replace(/ü/gi, 'ue')
        .replace(/ß/g, 'ss')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // Remove combining diacritics
        .replace(/[^a-z0-9]+/g, '-')       // Replace non-alphanum with hyphens
        .replace(/^-+|-+$/g, '');           // Trim leading/trailing hyphens
}
