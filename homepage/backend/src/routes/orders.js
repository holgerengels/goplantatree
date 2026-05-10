import { Router } from 'express';
import Order from '../models/Order.js';
import Project from '../models/Project.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = Router();

const resolveProject = async (slug) => {
    const project = await Project.findOne({ slug });
    return project?._id || null;
};

// POST /api/v1/orders — Public: create new order
router.post('/', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.status(201).json({ orderNumber: order.orderNumber, message: 'Bestellung erfolgreich aufgegeben' });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        res.status(400).json({ error: err.message });
    }
});

// GET /api/v1/orders?project=slug&status=neu — Admin: list orders
router.get('/', auth, requirePermission('orders', 'read'), async (req, res) => {
    try {
        const filter = {};
        if (req.permissionScope === 'own') {
            filter.project = req.user.project;
        } else if (req.query.project) {
            const projectId = await resolveProject(req.query.project);
            if (projectId) filter.project = projectId;
        }
        if (req.query.status) filter.status = req.query.status;

        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;

        const orders = await Order.find(filter)
            .populate('offering', 'name category')
            .populate('project', 'name slug')
            .sort({ orderedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments(filter);
        res.json({ orders, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/orders/:id — Admin: get single order
router.get('/:id', auth, requirePermission('orders', 'read'), async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') query.project = req.user.project;
        
        const order = await Order.findOne(query)
            .populate('offering')
            .populate('project', 'name slug');
        if (!order) return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/v1/orders/:id — Admin: update order (status change etc.)
router.put('/:id', auth, requirePermission('orders', 'update'), async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') {
            query.project = req.user.project;
            req.body.project = req.user.project;
        }
        const order = await Order.findOneAndUpdate(query, req.body, { new: true, runValidators: true });
        if (!order) return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/v1/orders/:id — Admin
router.delete('/:id', auth, requirePermission('orders', 'delete'), async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') query.project = req.user.project;
        const order = await Order.findOneAndDelete(query);
        if (!order) return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        res.json({ message: 'Bestellung gelöscht' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
