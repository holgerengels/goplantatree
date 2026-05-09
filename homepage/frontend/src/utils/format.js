/**
 * Shared formatting utilities.
 */

/**
 * Format a date string in short German format: "06.05.2026"
 */
export function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE');
}

/**
 * Format a date string in long German format: "6. Mai 2026"
 */
export function formatDateLong(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
