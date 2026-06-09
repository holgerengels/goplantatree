/**
 * Simple template engine for newsletter and transactional mails.
 *
 * Replaces {{key}} placeholders with values from a variables map.
 * Supports nested access via dot notation: {{data.orderNumber}}
 *
 * Available variables (set by caller):
 *   {{name}}            — Subscriber name
 *   {{email}}           — Subscriber email
 *   {{project}}         — Project slug
 *   {{topic}}           — Topic
 *   {{unsubscribe_url}} — Individual unsubscribe link
 *   {{data.xxx}}        — Any field from subscriber.data
 */

/**
 * Resolve a dot-notated path on an object.
 * e.g. resolve({ data: { order: 42 } }, 'data.order') → 42
 */
function resolvePath(obj, path) {
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/**
 * Render a template string by replacing all {{key}} placeholders.
 *
 * @param {String} template - Text with {{...}} placeholders
 * @param {Object} variables - Flat or nested key-value map
 * @returns {String} Resolved text. Missing variables become empty string.
 */
export function renderTemplate(template, variables) {
    if (!template) return '';
    return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key) => {
        const trimmed = key.trim();
        const value = resolvePath(variables, trimmed);
        if (value === undefined || value === null) return '';
        return String(value);
    });
}

/**
 * Check if a template contains the {{unsubscribe_url}} placeholder.
 *
 * @param {String} template - HTML or text template
 * @returns {Boolean}
 */
export function hasUnsubscribeLink(template) {
    if (!template) return false;
    return /\{\{\s*unsubscribe_url\s*\}\}/.test(template);
}

/**
 * Build a variables map from a Subscriber document.
 *
 * @param {Object} subscriber - Mongoose Subscriber document (lean or hydrated)
 * @param {String} siteUrl - Base URL for building links
 * @returns {Object} Variables map ready for renderTemplate()
 */
export function buildSubscriberVariables(subscriber, siteUrl) {
    const base = siteUrl.replace(/\/$/, '');
    const vars = {
        name: subscriber.name || '',
        email: subscriber.email || '',
        project: subscriber.project || '',
        topic: subscriber.topic || '',
        unsubscribe_url: `${base}/abmelden/${subscriber.confirmToken}`,
        data: subscriber.data || {}
    };
    return vars;
}
