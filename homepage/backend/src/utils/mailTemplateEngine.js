/**
 * Template engine for newsletter and transactional mails.
 *
 * Supports both simple placeholders and JavaScript expressions:
 *   {{name}}                                    — Simple variable lookup
 *   {{data.orderNumber}}                        — Nested dot-notation access
 *   {{data.count > 1 ? "viele" : "eins"}}       — Ternary expressions
 *   {{data.selectedAddons ? "inkl. Korb" : ""}} — Conditional text
 *
 * Expression evaluation uses `new Function` with `with(variables)`,
 * following the same pattern as the tix frontend evaluator.
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
 * Evaluate a single expression string against a variables context.
 * Uses `with(variables)` so all top-level keys are accessible directly.
 */
function evaluateExpression(expr, variables) {
    const func = new Function('vars', `
        with(vars) {
            return ${expr};
        }
    `);
    return func(variables || {});
}

/**
 * Render a template string by evaluating all {{...}} expressions.
 *
 * If the entire string is a single {{expression}}, the native JS value
 * is returned (boolean, number, etc.). Otherwise each {{expression}}
 * is interpolated into the surrounding text as a string.
 *
 * @param {String} template - Text with {{...}} expressions
 * @param {Object} variables - Flat or nested key-value map
 * @returns {*} Resolved text, or native value for single-expression templates.
 *              Missing variables become empty string in interpolation mode.
 */
export function renderTemplate(template, variables) {
    if (!template) return '';

    // Single expression spanning the entire string → return native value
    const singleMatch = template.match(/^\{\{((?:[^}]|\}(?!\}))+)\}\}$/);
    if (singleMatch) {
        const expr = singleMatch[1].trim();
        try {
            return evaluateExpression(expr, variables);
        } catch (e) {
            console.warn('Expression evaluation failed:', template, e.message);
            return template;
        }
    }

    // Multiple expressions or mixed text → interpolate as strings
    return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
        try {
            const result = evaluateExpression(expr.trim(), variables);
            if (result === undefined || result === null) return '';
            return String(result);
        } catch (e) {
            console.warn('Expression evaluation failed:', match, e.message);
            return '';
        }
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
