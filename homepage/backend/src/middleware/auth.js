import jwt from 'jsonwebtoken';

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 */
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Ungültiger Token' });
    }
};

/**
 * Permission-based authorization middleware.
 * Usage: auth, requirePermission('orders', 'read')
 */
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions) {
            return res.status(403).json({ error: 'Keine Berechtigung (Kein Profil)' });
        }
        
        const resPerms = req.user.permissions[resource];
        if (!resPerms) {
            return res.status(403).json({ error: `Keine Berechtigung für ${resource}` });
        }
        
        const scope = resPerms[action];
        if (!scope || scope === 'none') {
            return res.status(403).json({ error: `Aktion ${action} auf ${resource} verweigert` });
        }
        
        req.permissionScope = scope; // 'own' or 'all'
        next();
    };
};

/**
 * Optional auth — attaches user if token present, but doesn't block.
 */
const optionalAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        const token = header.split(' ')[1];
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // ignore invalid token
        }
    }
    next();
};

export { auth, requirePermission, optionalAuth };
