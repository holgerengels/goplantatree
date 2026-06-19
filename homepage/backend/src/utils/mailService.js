import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import MailLog from '../models/MailLog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load mail config ─────────────────────────────────────────────────
let mailConfig;
try {
    const configPath = resolve(__dirname, '../../../config/mail.json');
    mailConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
    console.warn('[Mail] mail.json not found — mail service disabled');
    mailConfig = { accounts: {}, defaults: { rateLimitMs: 1500, maxPerHour: 200 } };
}

/**
 * Resolve account config for a project slug (or account key like 'info').
 * Credentials come from environment variables referenced in mail.json.
 */
export function getAccountConfig(accountKey) {
    const account = mailConfig.accounts[accountKey];
    if (!account) {
        throw new Error(`[Mail] No mail account configured for "${accountKey}"`);
    }
    const user = process.env[account.envUser];
    const pass = process.env[account.envPass];
    if (!user || !pass) {
        throw new Error(`[Mail] Missing env vars ${account.envUser}/${account.envPass} for account "${accountKey}"`);
    }
    return { ...account, user, pass };
}

// Cache transporters per account to reuse connections
const transporterCache = new Map();

export function getTransporter(accountKey) {
    if (transporterCache.has(accountKey)) return transporterCache.get(accountKey);

    const config = getAccountConfig(accountKey);
    const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: { user: config.user, pass: config.pass },
        tls: { minVersion: 'TLSv1.2' }
    });

    transporterCache.set(accountKey, transporter);
    return transporter;
}

/**
 * Send an email via the project's mailbox and log the result.
 *
 * @param {String} accountKey - Account key from mail.json (project slug or 'info')
 * @param {Object} options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Subject line
 * @param {String} options.html - HTML body
 * @param {String} [options.text] - Plain text fallback
 * @param {String} [options.template] - Template name for logging (e.g. 'order-confirmation')
 * @param {ObjectId} [options.referenceId] - Reference to Order, Subscriber, etc.
 * @param {String} [options.referenceType] - Model name of reference
 * @param {ObjectId} [options.projectId] - Project ObjectId for log association
 * @returns {Object} The created MailLog document
 */
export async function sendMail(accountKey, options) {
    const config = getAccountConfig(accountKey);

    // 1. Create log entry with status 'queued'
    const logEntry = await MailLog.create({
        project: options.projectId || null,
        to: options.to,
        from: config.from,
        subject: options.subject,
        template: options.template,
        referenceId: options.referenceId,
        referenceType: options.referenceType,
        status: 'queued'
    });

    try {
        // 2. Send via SMTP
        const transporter = getTransporter(accountKey);
        const info = await transporter.sendMail({
            from: config.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
        });

        // 3. Update log: sent
        logEntry.status = 'sent';
        logEntry.sentAt = new Date();
        logEntry.smtpResponse = info.response;
        await logEntry.save();

        return logEntry;
    } catch (err) {
        // 4. Update log: failed
        logEntry.status = 'failed';
        logEntry.error = err.message;
        await logEntry.save();

        console.error(`[Mail] Failed to send to ${options.to}:`, err.message);
        return logEntry;
    }
}

/**
 * Verify SMTP connection for an account.
 * Useful for admin health checks.
 */
export async function verifyConnection(accountKey) {
    const transporter = getTransporter(accountKey);
    return transporter.verify();
}

/**
 * Get available account keys.
 */
export function getAccountKeys() {
    return Object.keys(mailConfig.accounts);
}

/**
 * Get rate limit config.
 */
export function getRateLimitConfig() {
    return mailConfig.defaults || { rateLimitMs: 1500, maxPerHour: 200 };
}
