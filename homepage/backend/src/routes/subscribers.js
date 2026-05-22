import { createCrudRouter } from '../utils/crudFactory.js';
import Subscriber from '../models/Subscriber.js';
import Project from '../models/Project.js';
import { sendMail, getAccountKeys } from '../utils/mailService.js';

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

/**
 * Pick the best mail account for a project.
 * Tries the project slug first, falls back to 'info'.
 */
function resolveMailAccount(projectSlug) {
    const accounts = getAccountKeys();
    if (projectSlug && accounts.includes(projectSlug)) return projectSlug;
    return 'info';
}

// POST /api/v1/subscribers — Public: subscribe to mailing list
router.post('/', async (req, res, next) => {
    try {
        const payload = { ...req.body };
        let projectSlug = null;

        if (payload.project && !payload.project.match(/^[0-9a-fA-F]{24}$/)) {
            projectSlug = payload.project;
            const project = await Project.findOne({ slug: payload.project });
            if (project) {
                payload.project = project._id;
            } else {
                delete payload.project;
            }
        }

        const subscriber = new Subscriber(payload);
        await subscriber.save();

        // Send Double-Opt-In confirmation email
        const siteUrl = (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
        const confirmUrl = `${siteUrl}/bestaetigen/${subscriber.confirmToken}`;
        const account = resolveMailAccount(projectSlug);

        try {
            await sendMail(account, {
                to: subscriber.email,
                subject: '🌳 Bitte bestätige deine Anmeldung',
                html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                        <h2 style="color: #2E5641;">Anmeldung bestätigen</h2>
                        <p>Hallo${subscriber.name ? ` ${subscriber.name}` : ''},</p>
                        <p>bitte bestätige deine Newsletter-Anmeldung mit einem Klick auf den folgenden Link:</p>
                        <p style="margin: 24px 0;">
                            <a href="${confirmUrl}" style="background: #2E5641; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                                ✅ Anmeldung bestätigen
                            </a>
                        </p>
                        <p style="color: #888; font-size: 12px;">Falls du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.</p>
                    </div>
                `,
                text: `Bitte bestätige deine Newsletter-Anmeldung:\n${confirmUrl}\n\nFalls du dich nicht angemeldet hast, kannst du diese E-Mail ignorieren.`,
                template: 'subscribe-confirm',
                referenceId: subscriber._id,
                referenceType: 'Subscriber',
                projectId: subscriber.project || null
            });
        } catch (mailErr) {
            console.error('[Subscriber] Confirmation mail failed:', mailErr.message);
        }

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

// GET /api/v1/subscribers/unsubscribe/:token — Public: unsubscribe from mailing list
router.get('/unsubscribe/:token', async (req, res, next) => {
    try {
        const subscriber = await Subscriber.findOne({ confirmToken: req.params.token })
            .populate('project', 'name slug');
        if (!subscriber) return res.status(404).json({ error: 'Ungültiger Abmelde-Link' });

        const info = {
            message: 'Erfolgreich abgemeldet.',
            email: subscriber.email,
            name: subscriber.name,
            project: subscriber.project?.slug || null,
            topic: subscriber.topic
        };

        await Subscriber.deleteOne({ _id: subscriber._id });
        res.json(info);
    } catch (err) {
        next(err);
    }
});

export default router;

