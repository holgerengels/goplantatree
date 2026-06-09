import express from 'express';
import MailLog from '../models/MailLog.js';
import Subscriber from '../models/Subscriber.js';
import { sendMail, verifyConnection, getAccountKeys, getRateLimitConfig } from '../utils/mailService.js';
import { checkBounces } from '../utils/bounceChecker.js';
import { renderTemplate, hasUnsubscribeLink, buildSubscriberVariables } from '../utils/mailTemplateEngine.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// All mail routes require admin authentication
router.use(auth, requirePermission('mail', 'read'));

/**
 * GET /api/v1/mail/accounts
 * List available mail accounts.
 */
router.get('/accounts', (req, res) => {
    res.json(getAccountKeys());
});

/**
 * GET /api/v1/mail/log
 * Query mail log entries.
 * Query params: project, status, to, template, limit, skip
 */
router.get('/log', async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.project) filter.project = req.query.project;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.to) filter.to = { $regex: req.query.to, $options: 'i' };
        if (req.query.template) filter.template = req.query.template;

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const skip = parseInt(req.query.skip) || 0;

        const [items, total] = await Promise.all([
            MailLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MailLog.countDocuments(filter)
        ]);

        res.json({ items, total, limit, skip });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/mail/stats
 * Summary statistics per status.
 */
router.get('/stats', async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.project) filter.project = req.query.project;

        const stats = await MailLog.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const result = { queued: 0, sent: 0, bounced: 0, failed: 0 };
        stats.forEach(s => { result[s._id] = s.count; });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/test
 * Send a test email to verify SMTP config.
 * Body: { account, to }
 */
router.post('/test', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const { account, to } = req.body;
        if (!account || !to) {
            return res.status(400).json({ error: 'account und to sind Pflichtfelder' });
        }

        const logEntry = await sendMail(account, {
            to,
            subject: '🌳 Go Plant A Tree — Test-Mail',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #2E5641;">✅ Mail-System funktioniert!</h2>
                    <p>Diese Test-Mail wurde erfolgreich über das Konto <strong>${account}</strong> versendet.</p>
                    <p style="color: #888; font-size: 12px;">Gesendet am ${new Date().toLocaleString('de-DE')}</p>
                </div>
            `,
            text: `Go Plant A Tree — Test-Mail\n\nMail-System funktioniert! Gesendet über Konto: ${account}`,
            template: 'test'
        });

        res.json({ success: logEntry.status === 'sent', log: logEntry });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/verify/:account
 * Verify SMTP connection for an account.
 */
router.post('/verify/:account', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        await verifyConnection(req.params.account);
        res.json({ success: true, message: `SMTP-Verbindung zu ${req.params.account} OK` });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

/**
 * POST /api/v1/mail/check-bounces/:account
 * Check IMAP for bounce messages and update MailLog.
 */
router.post('/check-bounces/:account', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const result = await checkBounces(req.params.account);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/send-newsletter
 * Send a newsletter to matching subscribers.
 *
 * Body:
 *   account  — Mail account key (e.g. 'info', 'klimabaumaktion-ulm')
 *   project  — (optional) Filter by project slug
 *   topic    — (optional) Filter by topic
 *   subject  — Subject line (may contain {{...}} placeholders)
 *   html     — HTML body (must contain {{unsubscribe_url}})
 *   text     — (optional) Plain text fallback
 *
 * Sends one mail per subscriber with rate limiting.
 * Returns summary: { total, sent, failed, errors }
 */
router.post('/send-newsletter', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const { account, project, topic, subject, html, text } = req.body;

        // Validate required fields
        if (!account || !subject || !html) {
            return res.status(400).json({ error: 'account, subject und html sind Pflichtfelder.' });
        }

        // Check for unsubscribe link placeholder
        if (!hasUnsubscribeLink(html)) {
            return res.status(400).json({
                error: 'Der Mail-Body muss den Platzhalter {{unsubscribe_url}} enthalten, damit Empfänger sich abmelden können.'
            });
        }

        // Build subscriber query: confirmed AND NOT bounced/unsubscribed
        const subscriberFilter = {
            status: { $all: ['confirmed'], $nin: ['bounced', 'unsubscribed'] }
        };
        if (project) subscriberFilter.project = project;
        if (topic) subscriberFilter.topic = topic;

        const subscribers = await Subscriber.find(subscriberFilter).lean();
        if (subscribers.length === 0) {
            return res.json({ total: 0, sent: 0, failed: 0, errors: [], message: 'Keine passenden Empfänger gefunden.' });
        }

        const siteUrl = (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
        const { rateLimitMs } = getRateLimitConfig();

        const result = { total: subscribers.length, sent: 0, failed: 0, errors: [] };

        for (let i = 0; i < subscribers.length; i++) {
            const sub = subscribers[i];
            const vars = buildSubscriberVariables(sub, siteUrl);

            const renderedSubject = renderTemplate(subject, vars);
            const renderedHtml = renderTemplate(html, vars);
            const renderedText = text ? renderTemplate(text, vars) : undefined;

            try {
                const logEntry = await sendMail(account, {
                    to: sub.email,
                    subject: renderedSubject,
                    html: renderedHtml,
                    text: renderedText,
                    template: 'newsletter',
                    referenceId: sub._id,
                    referenceType: 'Subscriber',
                    projectId: sub.project || null
                });

                if (logEntry.status === 'sent') {
                    result.sent++;
                } else {
                    result.failed++;
                    result.errors.push({ email: sub.email, error: logEntry.error || 'Unbekannter Fehler' });
                }
            } catch (err) {
                result.failed++;
                result.errors.push({ email: sub.email, error: err.message });
            }

            // Rate limiting between mails (skip delay after last mail)
            if (i < subscribers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, rateLimitMs));
            }
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;

