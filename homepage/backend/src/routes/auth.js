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

        const user = await User.findOne({ username }).populate('profile');
        if (!user) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const valid = await user.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        let permissions = {};
        if (user.profile && user.profile.permissions) {
            user.profile.permissions.forEach(p => {
                permissions[p.resource] = {
                    read: p.read, create: p.create, update: p.update, delete: p.delete
                };
            });
        }

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
