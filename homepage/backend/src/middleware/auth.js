import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Merge permissions from multiple profiles into a single permissions object.
 * Higher permission levels win (none < own < all).
 * @param {Array} profiles - Array of populated PermissionProfile documents
 * @returns {Object} Merged permissions keyed by resource
 */
const permissionLevels = { none: 0, own: 1, all: 2 };
const permissionLevelNames = ['none', 'own', 'all'];

function mergeProfilePermissions(profiles) {
    const permissions = {};
    if (!profiles || !Array.isArray(profiles)) return permissions;

    const mergePermission = (val1, val2) => {
        const level1 = permissionLevels[val1] || 0;
        const level2 = permissionLevels[val2] || 0;
        return permissionLevelNames[Math.max(level1, level2)];
    };

    profiles.forEach(profile => {
        if (profile && profile.permissions) {
            profile.permissions.forEach(p => {
                if (!permissions[p.resource]) {
                    permissions[p.resource] = {
                        read: p.read || 'none',
                        create: p.create || 'none',
                        update: p.update || 'none',
                        delete: p.delete || 'none'
                    };
                } else {
                    permissions[p.resource].read = mergePermission(permissions[p.resource].read, p.read);
                    permissions[p.resource].create = mergePermission(permissions[p.resource].create, p.create);
                    permissions[p.resource].update = mergePermission(permissions[p.resource].update, p.update);
                    permissions[p.resource].delete = mergePermission(permissions[p.resource].delete, p.delete);
                }
            });
        }
    });

    return permissions;
}

/**
 * JWT authentication middleware.
 * Supports two authentication methods:
 *   1. Authorization: Bearer <token>  (JWT)
 *   2. x-api-key: <key>               (API key → user lookup)
 */
const auth = async (req, res, next) => {
    // 1. Try JWT Bearer token
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        const token = header.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Ungültiger Token' });
        }
    }

    // 2. Try API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
        try {
            const user = await User.findOne({ apiKey }).populate('profiles');
            if (!user) {
                return res.status(401).json({ error: 'Ungültiger API-Key' });
            }

            const permissions = mergeProfilePermissions(user.profiles);
            req.user = {
                id: user._id,
                username: user.username,
                project: user.project,
                permissions
            };
            return next();
        } catch (err) {
            return res.status(500).json({ error: 'Authentifizierungsfehler' });
        }
    }

    return res.status(401).json({ error: 'Nicht authentifiziert' });
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

export { auth, requirePermission, optionalAuth, mergeProfilePermissions };

