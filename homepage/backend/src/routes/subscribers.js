import { createCrudRouter } from '../utils/crudFactory.js';
import Subscriber from '../models/Subscriber.js';
import MailTemplate from '../models/MailTemplate.js';
import { sendMail, resolveMailAccount } from '../utils/mailService.js';
import { renderTemplate } from '../utils/mailTemplateEngine.js';

const router = createCrudRouter(Subscriber, 'subscribers', {
    disableRoutes: ['create'],
    sort: { subscribedAt: -1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.project) filter.project = req.query.project;

        // Topic filtering: include and/or exclude
        const includeTopic = req.query.topics || req.query.topic;
        const excludeTopic = req.query.excludeTopic;
        if (includeTopic && excludeTopic) {
            filter.topics = { $in: [includeTopic], $nin: [excludeTopic] };
        } else if (includeTopic) {
            filter.topics = includeTopic;
        } else if (excludeTopic) {
            filter.topics = { $nin: [excludeTopic] };
        }

        if (req.query.status) {
            filter.status = req.query.status === 'confirmed'
                ? { $all: ['confirmed'], $nin: ['bounced', 'unsubscribed'] }
                : req.query.status;
        }
        return filter;
    }
});



// POST /api/v1/subscribers — Public: subscribe to mailing list
router.post('/', async (req, res, next) => {
    try {
        // Security: only accept known fields (prevent arbitrary data injection)
        const { email, name, topic, topics, project } = req.body;
        const payload = { email, name, project: project || null };

        // Normalize: accept both 'topic' (string) and 'topics' (array) from clients
        if (topic && !topics) {
            payload.topics = [topic];
        } else if (topics) {
            payload.topics = Array.isArray(topics) ? topics : [topics];
        }

        const projectSlug = payload.project;

        // Security: always force empty status on public creation (prevent Double-Opt-In bypass)
        payload.status = [];

        const subscriber = new Subscriber(payload);
        await subscriber.save();

        // Only send Double-Opt-In email if subscriber is not already confirmed
        // (admin-created subscribers with status ['confirmed'] skip this)
        if (!subscriber.hasStatus('confirmed')) {
            const siteUrl = (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
            const confirmUrl = `${siteUrl}/bestaetigen/${subscriber.confirmToken}`;
            const account = resolveMailAccount(projectSlug);

            // Try to load template from DB (project-specific first, then without project)
            let template = null;
            if (projectSlug) {
                template = await MailTemplate.findOne({ slug: 'subscribe-confirm', project: projectSlug, active: true });
            }
            if (!template) {
                template = await MailTemplate.findOne({ slug: 'subscribe-confirm', project: null, active: true });
            }

            const vars = {
                name: subscriber.name || '',
                email: subscriber.email || '',
                project: subscriber.project || '',
                confirm_url: confirmUrl
            };

            const mailSubject = template
                ? renderTemplate(template.subject, vars)
                : '🌳 Bitte bestätige deine Anmeldung';

            const mailHtml = template
                ? renderTemplate(template.html, vars)
                : `
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
                `;

            try {
                await sendMail(account, {
                    to: subscriber.email,
                    subject: mailSubject,
                    html: mailHtml,
                    template: 'subscribe-confirm',
                    referenceId: subscriber._id,
                    referenceType: 'Subscriber',
                    projectId: subscriber.project || null
                });
            } catch (mailErr) {
                console.error('[Subscriber] Confirmation mail failed:', mailErr.message);
            }
        }

        const msg = subscriber.hasStatus('confirmed')
            ? 'Du bist bereits angemeldet.'
            : 'Bitte bestätige deine E-Mail-Adresse um angemeldet zu werden.';
        res.status(201).json({ message: msg });
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
        const subscriber = await Subscriber.findOne({ confirmToken: req.params.token });
        if (!subscriber) return res.status(404).json({ error: 'Ungültiger Bestätigungslink' });

        subscriber.addStatus('confirmed');
        subscriber.removeStatus('unsubscribed');
        await subscriber.save();

        res.json({ message: 'E-Mail-Adresse erfolgreich bestätigt!' });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/subscribers/unsubscribe/:token — Public: unsubscribe from mailing list
router.get('/unsubscribe/:token', async (req, res, next) => {
    try {
        const subscriber = await Subscriber.findOne({ confirmToken: req.params.token });
        if (!subscriber) return res.status(404).json({ error: 'Ungültiger Abmelde-Link' });

        subscriber.addStatus('unsubscribed');
        await subscriber.save();

        res.json({
            message: 'Erfolgreich abgemeldet.',
            email: subscriber.email,
            name: subscriber.name,
            project: subscriber.project || null,
            topics: subscriber.topics
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/subscribers/resubscribe/:token — Public: re-subscribe after unsubscribe
router.post('/resubscribe/:token', async (req, res, next) => {
    try {
        const subscriber = await Subscriber.findOne({ confirmToken: req.params.token });
        if (!subscriber) return res.status(404).json({ error: 'Ungültiger Link' });

        subscriber.removeStatus('unsubscribed');
        subscriber.addStatus('confirmed');
        await subscriber.save();

        res.json({ message: 'Erfolgreich wieder angemeldet!' });
    } catch (err) {
        next(err);
    }
});

export default router;

