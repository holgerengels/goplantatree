import { Router } from 'express';
import ChangeLog from '../models/ChangeLog.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/changelog
 * Readonly, paginated changelog with filters.
 * Requires changelog:read permission.
 */
router.get('/', auth, requirePermission('changelog', 'read'), async (req, res, next) => {
    try {
        const filter = {};

        if (req.query.resource) filter.resource = req.query.resource;
        if (req.query.documentId) filter.documentId = req.query.documentId;
        if (req.query.user) filter.user = req.query.user;
        if (req.query.action) filter.action = req.query.action;

        // Scope: 'own' users only see changes to their project
        if (req.permissionScope === 'own' && req.user?.project) {
            filter.$or = [
                { 'before.project': req.user.project },
                { 'after.project': req.user.project }
            ];
        }

        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;

        const [items, total] = await Promise.all([
            ChangeLog.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit),
            ChangeLog.countDocuments(filter)
        ]);

        res.json({ items, total });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/changelog/:documentId
 * Get all changelog entries for a specific document.
 */
router.get('/:documentId', auth, requirePermission('changelog', 'read'), async (req, res, next) => {
    try {
        const filter = { documentId: req.params.documentId };

        // Scope: 'own' users only see changes to their project
        if (req.permissionScope === 'own' && req.user?.project) {
            filter.$or = [
                { 'before.project': req.user.project },
                { 'after.project': req.user.project }
            ];
        }

        const items = await ChangeLog.find(filter).sort({ timestamp: -1 });
        res.json(items);
    } catch (err) {
        next(err);
    }
});

export default router;
