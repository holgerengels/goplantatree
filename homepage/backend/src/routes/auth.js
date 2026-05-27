import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username und Passwort erforderlich' });
        }

        const user = await User.findOne({ username }).populate('profile').populate('profiles');
        if (!user) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const valid = await user.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const permissionLevels = { none: 0, own: 1, all: 2 };
        const permissionLevelNames = ['none', 'own', 'all'];
        const mergePermission = (val1, val2) => {
            const level1 = permissionLevels[val1] || 0;
            const level2 = permissionLevels[val2] || 0;
            return permissionLevelNames[Math.max(level1, level2)];
        };

        const profilesList = [];
        if (user.profile) {
            profilesList.push(user.profile);
        }
        if (user.profiles && Array.isArray(user.profiles)) {
            user.profiles.forEach(p => {
                if (p && p._id && !profilesList.some(item => item._id.toString() === p._id.toString())) {
                    profilesList.push(p);
                }
            });
        }

        let permissions = {};
        profilesList.forEach(profile => {
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

        const token = jwt.sign(
            { id: user._id, username: user.username, project: user.project, permissions },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: user.toJSON(), permissions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/auth/me
router.get('/me', async (req, res) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    try {
        const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        res.json(user.toJSON());
    } catch (err) {
        res.status(401).json({ error: 'Ungültiger Token' });
    }
});

export default router;
