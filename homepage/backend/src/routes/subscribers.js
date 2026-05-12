import { createCrudRouter } from '../utils/crudFactory.js';
import Subscriber from '../models/Subscriber.js';
import Project from '../models/Project.js';

const router = createCrudRouter(Subscriber, 'subscribers', {
    disableRoutes: ['create', 'update', 'detail'],
    populate: { path: 'project', select: 'name slug' },
    sort: { subscribedAt: -1 },
    resolveParams: { project: { model: 'Project', lookupField: 'slug' } },
    buildFilter: (req, resolved) => {
        const filter = {};
        if (req.query.topic) filter.topic = req.query.topic;
        if (req.query.confirmed !== undefined) filter.confirmed = req.query.confirmed === 'true';
        return filter;
    }
});

// POST /api/v1/subscribers — Public: subscribe to mailing list
router.post('/', async (req, res, next) => {
    try {
        const payload = { ...req.body };
        if (payload.project && !payload.project.match(/^[0-9a-fA-F]{24}$/)) {
            const project = await Project.findOne({ slug: payload.project });
            if (project) {
                payload.project = project._id;
            } else {
                delete payload.project;
            }
        }

        const subscriber = new Subscriber(payload);
        await subscriber.save();
        res.status(201).json({ message: 'Erfolgreich angemeldet. Bitte bestätige deine E-Mail-Adresse.' });
    } catch (err) {
        if (err.code === 11000) {
            err.status = 409;
            err.message = 'Diese E-Mail-Adresse ist bereits angemeldet.';
        } else {
            err.status = 400;
        }
        next(err);
    }
});

// GET /api/v1/subscribers/confirm/:token — Public: confirm subscription
router.get('/confirm/:token', async (req, res, next) => {
    try {
        const subscriber = await Subscriber.findOneAndUpdate(
            { confirmToken: req.params.token },
            { confirmed: true },
            { new: true }
        );
        if (!subscriber) return res.status(404).json({ error: 'Ungültiger Bestätigungslink' });
        res.json({ message: 'E-Mail-Adresse erfolgreich bestätigt!' });
    } catch (err) {
        next(err);
    }
});

export default router;
