/**
 * Shared formatting utilities.
 */

/**
 * Format a date string in short German format: "15.5.2024"
 */
export function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE');
}

/**
 * @deprecated Use formatDate() — produces the same output.
 */
export const formatDateLong = formatDate;

/**
 * Format a date string with time in German format: "15.05.2024, 14:30"
 */
export function formatDateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
