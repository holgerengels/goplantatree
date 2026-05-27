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
 * Modify fields based on user permissions.
 */
export function applyPermissionsToFields(fields, user, resource, action, item) {
    if (!fields) return [];
    
    const permissions = user?.permissions || {};
    const resPerms = permissions[resource] || {};
    const scope = resPerms[action] || 'none';
    
    const isOwnItem = (resName, itm, usr) => {
        if (!usr || !usr.project) return false;
        const userProjId = typeof usr.project === 'object'
            ? (usr.project._id || usr.project.id)
            : usr.project;
            
        if (!userProjId) return false;
        
        if (resName === 'projects') {
            const itemId = itm?._id || itm?.id;
            return itemId && String(itemId) === String(userProjId);
        }
        
        if (itm && itm.project) {
            const itemProjId = typeof itm.project === 'object'
                ? (itm.project._id || itm.project.id)
                : itm.project;
            return itemProjId && String(itemProjId) === String(userProjId);
        }
        return false;
    };
    
    const isUpdate = action === 'update';
    
    let makeAllReadonly = false;
    if (scope === 'none') {
        makeAllReadonly = true;
    } else if (scope === 'own' && isUpdate && !isOwnItem(resource, item, user)) {
        makeAllReadonly = true;
    }
    
    return fields.map(field => {
        const copy = { ...field };
        
        if (makeAllReadonly) {
            copy.readonly = true;
        } else {
            // "die projektzuordnung ändern sollte ich nur können, wenn ich das recht habe, projektübergeordnete objekte zu editieren"
            // If the field is 'project', check if the user has 'all' permission for the update action.
            if (field.name === 'project') {
                const hasAllUpdate = resPerms.update === 'all';
                if (!hasAllUpdate) {
                    copy.readonly = true;
                }
            }
        }
        
        return copy;
    });
}

/**
 * Validate data against field definitions.
 * Returns { isValid: boolean, errors: string[] }
 */
export function validateFields(data, fields, user = null, resource = '', action = '') {
    const errors = [];
    
    if (!fields) return { isValid: true, errors };
    
    let evaluated = evaluateFields(fields, data);
    if (user && resource && action) {
        evaluated = applyPermissionsToFields(evaluated, user, resource, action, data);
    }
    
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
