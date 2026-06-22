import express from 'express';
import MailLog from '../models/MailLog.js';
import Campaign from '../models/Campaign.js';
import Subscriber from '../models/Subscriber.js';
import { sendMail, verifyConnection, getAccountKeys, getRateLimitConfig, getTransporter, getAccountConfig } from '../utils/mailService.js';
import { checkBounces } from '../utils/bounceChecker.js';
import { renderTemplate, hasUnsubscribeLink, buildSubscriberVariables } from '../utils/mailTemplateEngine.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// All mail routes require admin authentication
router.use(auth, requirePermission('mail', 'read'));

// Track which campaigns are actively being processed in this process
const runningCampaigns = new Set();

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

/**
 * POST /api/v1/mail/check-bounces
 * Check ALL configured accounts for bounces.
 */
router.post('/check-bounces', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const accounts = getAccountKeys();
        const combined = { checked: 0, bounced: 0, details: [] };
        const errors = [];

        for (const account of accounts) {
            try {
                const result = await checkBounces(account);
                combined.checked += result.checked;
                combined.bounced += result.bounced;
                combined.details.push(...result.details);
            } catch (err) {
                errors.push({ account, error: err.message });
            }
        }

        if (errors.length > 0) combined.errors = errors;
        res.json(combined);
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
async function processCampaignQueue(campaignId) {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) return;

    runningCampaigns.add(campaignId);

    const { account, subjectTemplate: subject, htmlTemplate: html, textTemplate: text } = campaign;
    const siteUrl = (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
    const { rateLimitMs, maxPerHour } = getRateLimitConfig();

    await Campaign.updateOne({ campaignId }, { status: 'sending' });

    let sentThisWindow = 0;
    let windowStart = Date.now();

    try {
        while (true) {
            // Check if aborted (re-read from DB to catch external abort)
            const freshCampaign = await Campaign.findOne({ campaignId }, { status: 1 }).lean();
            if (freshCampaign?.status === 'aborted') {
                console.log(`[Campaign ${campaignId}] Aborted by user.`);
                break;
            }

            // Rate limit: wait until next window if we've sent enough this hour
            if (sentThisWindow >= maxPerHour) {
                await Campaign.updateOne({ campaignId }, { status: 'rate-limited' });
                const elapsed = Date.now() - windowStart;
                const waitMs = Math.max(0, 3600000 - elapsed);
                console.log(`[Campaign ${campaignId}] Rate limit reached (${sentThisWindow}/${maxPerHour}). Waiting ${Math.round(waitMs / 1000)}s.`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                sentThisWindow = 0;
                windowStart = Date.now();
                await Campaign.updateOne({ campaignId }, { status: 'sending' });
            }

            // Fetch next queued entry
            const logEntry = await MailLog.findOne({ campaignId, status: 'queued' });
            if (!logEntry) {
                console.log(`[Campaign ${campaignId}] All mails processed.`);
                break;
            }

            const subscriber = await Subscriber.findById(logEntry.referenceId).lean();
            if (!subscriber) {
                logEntry.status = 'failed';
                logEntry.error = 'Subscriber not found';
                await logEntry.save();
                await Campaign.updateOne({ campaignId }, { $inc: { failed: 1 } });
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
                await Campaign.updateOne({ campaignId }, { $inc: { sent: 1 } });
                sentThisWindow++;
            } catch (smtpErr) {
                logEntry.status = 'failed';
                logEntry.error = smtpErr.message;
                await logEntry.save();
                await Campaign.updateOne({ campaignId }, {
                    $inc: { failed: 1 },
                    $push: { errors: { $each: [{ email: subscriber.email, error: smtpErr.message }], $slice: -50 } }
                });

                if (/\b55[0134]\b/.test(smtpErr.message)) {
                    try {
                        const sub = await Subscriber.findById(subscriber._id);
                        if (sub && !sub.status.includes('bounced')) {
                            sub.status.push('bounced');
                            await sub.save();
                        }
                    } catch { /* ignore */ }
                }
            }

            await new Promise(resolve => setTimeout(resolve, rateLimitMs));
        }
    } catch (err) {
        console.error(`[Campaign ${campaignId}] Unexpected error:`, err.message);
        await Campaign.updateOne({ campaignId }, {
            status: 'error',
            $push: { errors: { $each: [{ email: '(system)', error: err.message }], $slice: -50 } }
        });
    } finally {
        const final = await Campaign.findOne({ campaignId }, { status: 1 }).lean();
        if (final?.status === 'sending') {
            await Campaign.updateOne({ campaignId }, { status: 'completed', completedAt: new Date() });
        } else if (final?.status !== 'error') {
            await Campaign.updateOne({ campaignId }, { completedAt: new Date() });
        }
        runningCampaigns.delete(campaignId);
        console.log(`[Campaign ${campaignId}] Finished.`);
    }
}

/**
 * Send a mail directly via SMTP without creating a new MailLog entry.
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
        const { account, project, topic, excludeTopic, subject, html, text } = req.body;

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
        if (topic && excludeTopic) {
            subscriberFilter.topics = { $in: [topic], $nin: [excludeTopic] };
        } else if (topic) {
            subscriberFilter.topics = topic;
        } else if (excludeTopic) {
            subscriberFilter.topics = { $nin: [excludeTopic] };
        }

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

        // Create persistent campaign record
        await Campaign.create({
            campaignId,
            account,
            subjectTemplate: subject,
            htmlTemplate: html,
            textTemplate: text || null,
            project: project || null,
            topic: topic || null,
            total: toEnqueue.length,
            sent: 0,
            failed: 0,
            errors: [],
            status: 'starting'
        });

        // Start background processing (fire and forget)
        processCampaignQueue(campaignId);

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
        const campaigns = await Campaign.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Enrich with queued counts from MailLog
        const result = await Promise.all(campaigns.map(async (c) => {
            const queued = await MailLog.countDocuments({ campaignId: c.campaignId, status: 'queued' });
            const bounced = await MailLog.countDocuments({ campaignId: c.campaignId, status: 'bounced' });
            return {
                campaignId: c.campaignId,
                total: c.total,
                sent: c.sent,
                failed: c.failed,
                queued,
                bounced,
                startedAt: c.startedAt,
                lastActivity: c.updatedAt,
                status: c.status,
                errors: (c.errors || []).slice(-10)
            };
        }));

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
        const campaign = await Campaign.findOne({ campaignId }).lean();

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign nicht gefunden.' });
        }

        const queued = await MailLog.countDocuments({ campaignId, status: 'queued' });
        const bounced = await MailLog.countDocuments({ campaignId, status: 'bounced' });

        res.json({
            campaignId,
            total: campaign.total,
            sent: campaign.sent,
            failed: campaign.failed,
            queued,
            bounced,
            startedAt: campaign.startedAt,
            lastActivity: campaign.updatedAt,
            status: campaign.status,
            errors: (campaign.errors || []).slice(-10)
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/mail/campaigns/:id/resume
 * Resume a stopped/aborted campaign. All template data is read from the
 * persisted Campaign document — no form fields needed.
 */
router.post('/campaigns/:id/resume', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const campaignId = req.params.id;

        // Check if campaign is already running in this process
        if (runningCampaigns.has(campaignId)) {
            return res.status(409).json({ error: 'Campaign läuft bereits.' });
        }

        const campaign = await Campaign.findOne({ campaignId });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign nicht gefunden.' });
        }

        // Count remaining queued entries
        const queuedCount = await MailLog.countDocuments({ campaignId, status: 'queued' });
        if (queuedCount === 0) {
            campaign.status = 'completed';
            campaign.completedAt = new Date();
            await campaign.save();
            return res.json({ campaignId, queued: 0, message: 'Keine ausstehenden Mails.' });
        }

        // Start background processing (reads template from Campaign model)
        processCampaignQueue(campaignId);

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
 * Works even after server restart since status is persisted.
 */
router.post('/campaigns/:id/abort', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const campaignId = req.params.id;

        const result = await Campaign.updateOne(
            { campaignId, status: { $in: ['sending', 'rate-limited', 'starting'] } },
            { status: 'aborted' }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Keine laufende Campaign mit dieser ID.' });
        }

        res.json({ campaignId, message: 'Campaign wird abgebrochen. Bereits gesendete Mails bleiben erhalten.' });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/v1/mail/campaigns/:id
 * Delete a campaign and its MailLog entries.
 * Only allowed for non-running campaigns.
 */
router.delete('/campaigns/:id', requirePermission('mail', 'create'), async (req, res, next) => {
    try {
        const campaignId = req.params.id;

        // Don't allow deleting running campaigns
        if (runningCampaigns.has(campaignId)) {
            return res.status(409).json({ error: 'Campaign läuft noch und kann nicht gelöscht werden.' });
        }

        const campaign = await Campaign.findOne({ campaignId });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign nicht gefunden.' });
        }

        if (['sending', 'rate-limited', 'starting'].includes(campaign.status)) {
            return res.status(409).json({ error: 'Campaign läuft noch. Bitte erst abbrechen.' });
        }

        // Delete MailLog entries and campaign
        const logResult = await MailLog.deleteMany({ campaignId });
        await Campaign.deleteOne({ campaignId });

        console.log(`[Campaign ${campaignId}] Deleted: ${logResult.deletedCount} log entries removed`);
        res.json({ campaignId, deleted: true, logsRemoved: logResult.deletedCount });
    } catch (err) {
        next(err);
    }
});

export default router;
