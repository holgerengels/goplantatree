import express from 'express';
import MailLog from '../models/MailLog.js';
import Subscriber from '../models/Subscriber.js';
import { sendMail, verifyConnection, getAccountKeys, getRateLimitConfig, getTransporter, getAccountConfig } from '../utils/mailService.js';
import { checkBounces } from '../utils/bounceChecker.js';
import { renderTemplate, hasUnsubscribeLink, buildSubscriberVariables } from '../utils/mailTemplateEngine.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// All mail routes require admin authentication
router.use(auth, requirePermission('mail', 'read'));

// ─── Active campaigns (in-memory, survives within process lifetime) ───────
const activeCampaigns = new Map();

/**
 * Generate a human-readable campaign ID.
 */
function generateCampaignId() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `NL-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}h${pad(now.getMinutes())}`;
}

// ─── Existing endpoints (unchanged) ──────────────────────────────────────

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
 * Query params: project, status, to, template, campaignId, limit, skip
 */
router.get('/log', async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.project) filter.project = req.query.project;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.to) filter.to = { $regex: req.query.to, $options: 'i' };
        if (req.query.template) filter.template = req.query.template;
        if (req.query.campaignId) filter.campaignId = req.query.campaignId;

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

// ─── Campaign-based newsletter sending ───────────────────────────────────

/**
 * Background send loop for a campaign.
 *
 * Processes queued MailLog entries with rate limiting:
 * - Waits `rateLimitMs` between each mail
 * - Pauses when `maxPerHour` is reached, resumes next window
 * - Stops on abort or when queue is empty
 *
 * @param {String} campaignId
 * @param {String} account - Mail account key
 * @param {String} subject - Subject template
 * @param {String} html - HTML template
 * @param {String} [text] - Plain text template
 */
async function processCampaignQueue(campaignId, account, subject, html, text) {
    const campaign = activeCampaigns.get(campaignId);
    if (!campaign) return;

    const siteUrl = (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
    const { rateLimitMs, maxPerHour } = getRateLimitConfig();

    campaign.status = 'sending';
    campaign.startedAt = campaign.startedAt || new Date();

    let sentThisWindow = 0;
    let windowStart = Date.now();

    const resetWindowIfNeeded = async () => {
        const elapsed = Date.now() - windowStart;
        if (elapsed >= 3600000) {
            // New hour window
            sentThisWindow = 0;
            windowStart = Date.now();
        } else if (sentThisWindow >= maxPerHour) {
            // Hit hourly limit — wait until next window
            const waitMs = 3600000 - elapsed + 1000;
            console.log(`[Campaign ${campaignId}] Rate limit reached (${maxPerHour}/h). Pausing for ${Math.ceil(waitMs / 60000)} min …`);
            campaign.status = 'rate-limited';
            await new Promise(resolve => setTimeout(resolve, waitMs));
            sentThisWindow = 0;
            windowStart = Date.now();
            campaign.status = 'sending';
        }
    };

    try {
        // Process loop: fetch queued entries one by one
        while (true) {
            // Check for abort
            const currentCampaign = activeCampaigns.get(campaignId);
            if (!currentCampaign || currentCampaign.aborted) {
                console.log(`[Campaign ${campaignId}] Aborted.`);
                campaign.status = 'aborted';
                break;
            }

            // Rate limit check
            await resetWindowIfNeeded();

            // Fetch next queued entry
            const logEntry = await MailLog.findOne({ campaignId, status: 'queued' });
            if (!logEntry) {
                console.log(`[Campaign ${campaignId}] All mails processed.`);
                campaign.status = 'completed';
                break;
            }

            // Load subscriber for template rendering
            const subscriber = await Subscriber.findById(logEntry.referenceId).lean();
            if (!subscriber) {
                logEntry.status = 'failed';
                logEntry.error = 'Subscriber not found';
                await logEntry.save();
                campaign.failed++;
                continue;
            }

            const vars = buildSubscriberVariables(subscriber, siteUrl);
            const renderedSubject = renderTemplate(subject, vars);
            const renderedHtml = renderTemplate(html, vars);
            const renderedText = text ? renderTemplate(text, vars) : undefined;

            try {
                const info = await sendMailDirect(account, {
                    to: subscriber.email,
                    subject: renderedSubject,
                    html: renderedHtml,
                    text: renderedText
                });
                logEntry.status = 'sent';
                logEntry.sentAt = new Date();
                logEntry.smtpResponse = info.response;
                await logEntry.save();
                campaign.sent++;
                sentThisWindow++;
            } catch (smtpErr) {
                logEntry.status = 'failed';
                logEntry.error = smtpErr.message;
                await logEntry.save();
                campaign.failed++;
                campaign.errors.push({ email: subscriber.email, error: smtpErr.message });
            }

            // Progress logging every 50 mails
            const processed = campaign.sent + campaign.failed;
            if (processed % 50 === 0) {
                console.log(`[Campaign ${campaignId}] Progress: ${processed}/${campaign.total} (${campaign.sent} sent, ${campaign.failed} failed)`);
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, rateLimitMs));
        }
    } catch (err) {
        console.error(`[Campaign ${campaignId}] Unexpected error:`, err.message);
        campaign.status = 'error';
        campaign.errors.push({ email: '(system)', error: err.message });
    }

    campaign.completedAt = new Date();
    console.log(`[Campaign ${campaignId}] Finished: ${campaign.sent} sent, ${campaign.failed} failed, status: ${campaign.status}`);
}

/**
 * Send a mail directly via SMTP without creating a new MailLog entry.
 * Used by the campaign processor which manages its own log entries.
 */
function sendMailDirect(accountKey, options) {
    const config = getAccountConfig(accountKey);
    const transporter = getTransporter(accountKey);

    return transporter.sendMail({
        from: config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
    });
}

/**
 * POST /api/v1/mail/send-newsletter
 * Create a newsletter campaign and start background sending.
 *
 * Body:
 *   account  — Mail account key
 *   project  — (optional) Filter by project slug
 *   topic    — (optional) Filter by topic
 *   subject  — Subject line template
 *   html     — HTML body template (must contain {{unsubscribe_url}})
 *   text     — (optional) Plain text fallback template
 *
 * Returns immediately with { campaignId, total, queued }.
 * Use GET /campaigns/:id to poll progress.
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
        if (topic) subscriberFilter.topics = topic;

        const subscribers = await Subscriber.find(subscriberFilter).lean();
        if (subscribers.length === 0) {
            return res.json({ total: 0, sent: 0, failed: 0, queued: 0, message: 'Keine passenden Empfänger gefunden.' });
        }

        // Generate campaign ID
        const campaignId = generateCampaignId();

        // Find subscribers that already received this campaign (for resume scenarios with same campaignId)
        const alreadySent = await MailLog.find({
            campaignId,
            status: { $in: ['sent', 'queued'] }
        }).distinct('to');
        const alreadySentSet = new Set(alreadySent.map(e => e.toLowerCase()));

        // Create queued MailLog entries for each subscriber not yet processed
        const toEnqueue = subscribers.filter(s => !alreadySentSet.has(s.email.toLowerCase()));

        if (toEnqueue.length === 0) {
            return res.json({
                campaignId,
                total: subscribers.length,
                queued: 0,
                message: 'Alle Empfänger wurden bereits verarbeitet.'
            });
        }

        const logEntries = toEnqueue.map(sub => ({
            project: sub.project || null,
            to: sub.email,
            from: null, // Will be set by sendMailDirect
            subject: subject,
            template: 'newsletter',
            referenceId: sub._id,
            referenceType: 'Subscriber',
            campaignId,
            status: 'queued'
        }));

        await MailLog.insertMany(logEntries);

        // Register campaign in memory
        const campaign = {
            campaignId,
            account,
            subject,
            html,
            text: text || null,
            project: project || null,
            topic: topic || null,
            total: toEnqueue.length,
            sent: 0,
            failed: 0,
            errors: [],
            status: 'starting',
            startedAt: new Date(),
            completedAt: null,
            aborted: false
        };
        activeCampaigns.set(campaignId, campaign);

        // Start background processing (fire and forget)
        processCampaignQueue(campaignId, account, subject, html, text);

        console.log(`[Campaign ${campaignId}] Created: ${toEnqueue.length} mails queued for account "${account}"`);

        res.json({
            campaignId,
            total: toEnqueue.length,
            queued: toEnqueue.length,
            message: `Campaign ${campaignId} gestartet. ${toEnqueue.length} Mails in der Queue.`
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/mail/campaigns
 * List recent campaigns with their status.
 */
router.get('/campaigns', async (req, res, next) => {
    try {
        // Get campaigns from DB (aggregated from MailLog)
        const campaigns = await MailLog.aggregate([
            { $match: { campaignId: { $ne: null } } },
            {
                $group: {
                    _id: '$campaignId',
                    total: { $sum: 1 },
                    sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                    queued: { $sum: { $cond: [{ $eq: ['$status', 'queued'] }, 1, 0] } },
                    bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } },
                    startedAt: { $min: '$createdAt' },
                    lastActivity: { $max: '$updatedAt' }
                }
            },
            { $sort: { startedAt: -1 } },
            { $limit: 20 }
        ]);

        // Enrich with in-memory status
        const result = campaigns.map(c => {
            const active = activeCampaigns.get(c._id);
            return {
                campaignId: c._id,
                total: c.total,
                sent: c.sent,
                failed: c.failed,
                queued: c.queued,
                bounced: c.bounced,
                startedAt: c.startedAt,
                lastActivity: c.lastActivity,
                status: active?.status || (c.queued > 0 ? 'stopped' : 'completed'),
                errors: active?.errors?.slice(-10) || []
            };
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/mail/campaigns/:id
 * Get progress for a specific campaign.
 */
router.get('/campaigns/:id', async (req, res, next) => {
    try {
        const campaignId = req.params.id;

        // Aggregate current state from DB (source of truth)
        const [stats] = await MailLog.aggregate([
            { $match: { campaignId } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                    queued: { $sum: { $cond: [{ $eq: ['$status', 'queued'] }, 1, 0] } },
                    bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } },
                    startedAt: { $min: '$createdAt' },
                    lastActivity: { $max: '$updatedAt' }
                }
            }
        ]);

        if (!stats) {
            return res.status(404).json({ error: 'Campaign nicht gefunden.' });
        }

        // Get last errors from DB
        const failedEntries = await MailLog.find({ campaignId, status: 'failed' })
            .sort({ updatedAt: -1 })
            .limit(20)
            .select('to error updatedAt')
            .lean();

        // In-memory status (if campaign is still active in this process)
        const active = activeCampaigns.get(campaignId);

        res.json({
            campaignId,
            total: stats.total,
            sent: stats.sent,
            failed: stats.failed,
            queued: stats.queued,
            bounced: stats.bounced,
            startedAt: stats.startedAt,
            lastActivity: stats.lastActivity,
            status: active?.status || (stats.queued > 0 ? 'stopped' : 'completed'),
            errors: failedEntries.map(e => ({ email: e.to, error: e.error }))
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/campaigns/:id/resume
 * Resume a stopped/aborted campaign by reprocessing queued entries.
 *
 * Body:
 *   account — Mail account key (required, in case server restarted and lost in-memory state)
 *   subject — Subject template (required)
 *   html    — HTML template (required)
 *   text    — (optional) Plain text template
 */
router.post('/campaigns/:id/resume', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const campaignId = req.params.id;
        const { account, subject, html, text } = req.body;

        if (!account || !subject || !html) {
            return res.status(400).json({ error: 'account, subject und html sind Pflichtfelder.' });
        }

        // Check if campaign is already running
        const existing = activeCampaigns.get(campaignId);
        if (existing && existing.status === 'sending') {
            return res.status(409).json({ error: 'Campaign läuft bereits.' });
        }

        // Count remaining queued entries
        const queuedCount = await MailLog.countDocuments({ campaignId, status: 'queued' });
        if (queuedCount === 0) {
            return res.json({ campaignId, queued: 0, message: 'Keine ausstehenden Mails.' });
        }

        // Get total count for progress tracking
        const totalCount = await MailLog.countDocuments({ campaignId });
        const sentCount = await MailLog.countDocuments({ campaignId, status: 'sent' });
        const failedCount = await MailLog.countDocuments({ campaignId, status: 'failed' });

        // Register campaign in memory
        const campaign = {
            campaignId,
            account,
            subject,
            html,
            text: text || null,
            total: totalCount,
            sent: sentCount,
            failed: failedCount,
            errors: [],
            status: 'resuming',
            startedAt: new Date(),
            completedAt: null,
            aborted: false
        };
        activeCampaigns.set(campaignId, campaign);

        // Start background processing
        processCampaignQueue(campaignId, account, subject, html, text);

        console.log(`[Campaign ${campaignId}] Resumed: ${queuedCount} mails remaining`);

        res.json({
            campaignId,
            queued: queuedCount,
            message: `Campaign wird fortgesetzt. ${queuedCount} Mails ausstehend.`
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/campaigns/:id/abort
 * Abort a running campaign. Already sent mails are kept.
 */
router.post('/campaigns/:id/abort', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const campaignId = req.params.id;
        const campaign = activeCampaigns.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Keine aktive Campaign mit dieser ID.' });
        }

        campaign.aborted = true;
        res.json({ campaignId, message: 'Campaign wird abgebrochen. Bereits gesendete Mails bleiben erhalten.' });
    } catch (err) {
        next(err);
    }
});

export default router;
