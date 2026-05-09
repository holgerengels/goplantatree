/**
 * Template expression evaluator, inspired by the tix system.
 * Evaluates {{ expressions }} in field properties (visible, readonly, required).
 */

/**
 * Evaluate a single template expression string.
 * Returns the evaluated value, or the original string if evaluation fails.
 */
export function evaluateExpression(expr, context) {
    if (typeof expr !== 'string') return expr;
    
    // Check if it's a template expression
    const match = expr.match(/^\{\{(.+)\}\}$/s);
    if (!match) return expr;
    
    const code = match[1].trim();
    try {
        const func = new Function('data', `
            with(data) {
                return ${code};
            }
        `);
        return func(context || {});
    } catch (err) {
        // Graceful fallback: return original string on error
        console.warn('Expression evaluation failed:', expr, err.message);
        return expr;
    }
}

/**
 * Evaluate all dynamic properties of fields against current data.
 * Returns a new array of fields with resolved visible/readonly/required.
 */
export function evaluateFields(fields, data) {
    if (!fields) return [];
    
    return fields.map(field => {
        const evaluated = { ...field };
        
        // Evaluate visibility
        if (typeof field.visible === 'string') {
            evaluated.visible = evaluateExpression(field.visible, data);
        }
        
        // Evaluate readonly
        if (typeof field.readonly === 'string') {
            evaluated.readonly = evaluateExpression(field.readonly, data);
        }
        
        // Evaluate required
        if (typeof field.required === 'string') {
            evaluated.required = evaluateExpression(field.required, data);
        }
        
        return evaluated;
    });
}

/**
 * Validate data against field definitions.
 * Returns { isValid: boolean, errors: string[] }
 */
export function validateFields(data, fields) {
    const errors = [];
    
    if (!fields) return { isValid: true, errors };
    
    const evaluated = evaluateFields(fields, data);
    
    for (const field of evaluated) {
        // Skip invisible fields
        if (field.visible === false) continue;
        
        // Check required
        if (field.required === true) {
            const value = data[field.name];
            if (value === undefined || value === null || value === '' || value === false) {
                errors.push(`${field.label || field.name} ist ein Pflichtfeld`);
            }
        }
        
        // Check field-level validation
        if (field.validation) {
            const result = evaluateExpression(`{{${field.validation.expression}}}`, data);
            if (result === false) {
                errors.push(field.validation.message || `${field.label} ist ungültig`);
            }
        }
    }
    
    return { isValid: errors.length === 0, errors };
}
