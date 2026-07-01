import { Router } from 'express';
import ChangeLog from '../models/ChangeLog.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = Router();

/**
 * Apply project-based scope filtering for 'own' permission users.
 * Restricts results to changelog entries where the document's project matches the user's project.
 */
const applyScope = (filter, req) => {
    if (req.permissionScope === 'own' && req.user?.project) {
        filter.$or = [
            { 'before.project': req.user.project },
            { 'after.project': req.user.project }
        ];
    }
    return filter;
};

/**
 * GET /api/v1/changelog/distinct/:field
 * Distinct values for a field (for filter dropdowns).
 */
router.get('/distinct/:field', auth, requirePermission('changelog', 'read'), async (req, res, next) => {
    try {
        const field = req.params.field;
        if (!/^[a-zA-Z_]+$/.test(field)) {
            return res.status(400).json({ error: 'Ungültiger Feldname' });
        }
        const values = await ChangeLog.distinct(field);
        const cleaned = values
            .filter(v => v != null && v !== '')
            .sort((a, b) => String(a).localeCompare(String(b)));
        res.json(cleaned);
    } catch (err) {
        next(err);
    }
});

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

        applyScope(filter, req);

        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;

        // Configurable sort (only allow known fields)
        const SORTABLE = ['timestamp', 'resource', 'action', 'user', 'documentSlug'];
        let sort = { timestamp: -1 };
        if (req.query.sort && SORTABLE.includes(req.query.sort)) {
            const dir = req.query.sortDir === 'asc' ? 1 : -1;
            sort = { [req.query.sort]: dir };
        }

        const [items, total] = await Promise.all([
            ChangeLog.find(filter)
                .select('-before -after')
                .sort(sort)
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

        applyScope(filter, req);

        const items = await ChangeLog.find(filter).sort({ timestamp: -1 });
        res.json(items);
    } catch (err) {
        next(err);
    }
});

export default router;
