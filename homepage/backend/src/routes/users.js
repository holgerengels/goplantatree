import { createCrudRouter } from '../utils/crudFactory.js';
import User from '../models/User.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = createCrudRouter(User, 'users', {
    disableRoutes: ['update'],
    populate: [
        { path: 'profile', select: 'name' },
        { path: 'project', select: 'name slug' }
    ],
    sort: { username: 1 }
});

// PUT /api/v1/users/:id — Admin: update user
router.put('/:id', auth, requirePermission('users', 'update'), async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') {
            query.project = req.user.project;
            req.body.project = req.user.project;
        }

        if (!req.body.passwordHash) {
            delete req.body.passwordHash;
        }

        const fetchedUser = await User.findOne(query);
        if (!fetchedUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        
        Object.assign(fetchedUser, req.body);
        await fetchedUser.save();
        
        res.json(fetchedUser);
    } catch (err) {
        err.status = 400;
        next(err);
    }
});

export default router;
