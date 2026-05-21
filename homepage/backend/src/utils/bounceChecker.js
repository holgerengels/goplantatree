import { ImapFlow } from 'imapflow';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import MailLog from '../models/MailLog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mailConfig;
try {
    const configPath = resolve(__dirname, '../../../config/mail.json');
    mailConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
    mailConfig = { accounts: {} };
}

/**
 * Parse bounce emails from IMAP and update MailLog entries.
 *
 * Strategy:
 * 1. Connect to IMAP inbox
 * 2. Search for recent unread messages that look like bounces
 * 3. Extract the original recipient from bounce content
 * 4. Find matching MailLog entry (sent to that address recently)
 * 5. Update status to 'bounced' with diagnostic info
 *
 * @param {String} accountKey - Account key from mail.json
 * @returns {Object} { checked: number, bounced: number, details: [] }
 */
export async function checkBounces(accountKey) {
    const account = mailConfig.accounts[accountKey];
    if (!account) {
        throw new Error(`[BounceChecker] No account config for "${accountKey}"`);
    }

    const user = process.env[account.envUser];
    const pass = process.env[account.envPass];
    if (!user || !pass) {
        throw new Error(`[BounceChecker] Missing credentials for "${accountKey}"`);
    }

    const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: { user, pass },
        logger: false
    });

    const result = { checked: 0, bounced: 0, details: [] };

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        try {
            // Search for unseen messages that look like bounces
            // Common bounce subjects/senders
            const messages = client.fetch(
                { seen: false },
                { envelope: true, source: true }
            );

            for await (const msg of messages) {
                result.checked++;
                const envelope = msg.envelope;
                const subject = envelope.subject || '';
                const from = envelope.from?.[0]?.address || '';

                // Detect bounce by subject patterns and sender
                const isBounce = isBounceMessage(subject, from);
                if (!isBounce) continue;

                // Extract original recipient from bounce body
                const source = msg.source?.toString('utf-8') || '';
                const bouncedAddress = extractBouncedAddress(source);
                const diagnosticCode = extractDiagnosticCode(source);
                const bounceType = diagnosticCode?.startsWith('5') ? 'hard' : 'soft';

                if (!bouncedAddress) continue;

                // Find the most recent 'sent' MailLog entry for this recipient
                const logEntry = await MailLog.findOne({
                    to: bouncedAddress.toLowerCase(),
                    status: 'sent'
                }).sort({ sentAt: -1 });

                if (logEntry) {
                    logEntry.status = 'bounced';
                    logEntry.bounceInfo = {
                        detectedAt: new Date(),
                        type: bounceType,
                        diagnosticCode: diagnosticCode || 'unknown',
                        rawSubject: subject.substring(0, 200)
                    };
                    await logEntry.save();

                    result.bounced++;
                    result.details.push({
                        address: bouncedAddress,
                        type: bounceType,
                        diagnosticCode,
                        logId: logEntry._id
                    });
                }

                // Mark bounce message as seen
                await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
            }
        } finally {
            lock.release();
        }

        await client.logout();
    } catch (err) {
        console.error(`[BounceChecker] Error for ${accountKey}:`, err.message);
        throw err;
    }

    return result;
}

/**
 * Detect if a message is likely a bounce/NDR.
 */
function isBounceMessage(subject, from) {
    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();

    const bounceSubjects = [
        'undeliverable', 'undelivered', 'delivery status',
        'mail delivery failed', 'returned mail', 'failure notice',
        'nicht zustellbar', 'unzustellbar', 'zustellungsfehler',
        'delivery failure', 'mail system error'
    ];

    const bounceSenders = [
        'mailer-daemon', 'postmaster', 'mail-daemon'
    ];

    return bounceSubjects.some(p => subjectLower.includes(p)) ||
           bounceSenders.some(p => fromLower.includes(p));
}

/**
 * Extract the original recipient address from a bounce message body.
 * Looks for common patterns in DSN (Delivery Status Notification) messages.
 */
function extractBouncedAddress(source) {
    // RFC 3464: Final-Recipient header
    const finalRecipient = source.match(/Final-Recipient:\s*(?:rfc822|smtp);\s*([^\s\r\n]+)/i);
    if (finalRecipient) return finalRecipient[1].toLowerCase();

    // Original-Recipient header
    const originalRecipient = source.match(/Original-Recipient:\s*(?:rfc822|smtp);\s*([^\s\r\n]+)/i);
    if (originalRecipient) return originalRecipient[1].toLowerCase();

    // Common pattern: "The following address failed: user@example.com"
    const addressFailed = source.match(/(?:address|recipient)\s+(?:failed|rejected)[^:]*:\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i);
    if (addressFailed) return addressFailed[1].toLowerCase();

    // Fallback: look for email in "To: original@..." or X-Failed-Recipients
    const failedRecipients = source.match(/X-Failed-Recipients:\s*([^\s\r\n]+)/i);
    if (failedRecipients) return failedRecipients[1].toLowerCase();

    return null;
}

/**
 * Extract diagnostic/status code from DSN.
 */
function extractDiagnosticCode(source) {
    // RFC 3464 Diagnostic-Code field
    const diagnostic = source.match(/Diagnostic-Code:\s*smtp;\s*([^\r\n]+)/i);
    if (diagnostic) return diagnostic[1].trim().substring(0, 200);

    // Status field (e.g. "5.1.1")
    const status = source.match(/Status:\s*([245]\.\d+\.\d+)/i);
    if (status) return status[1];

    return null;
}

// Export helpers for testing
export { isBounceMessage, extractBouncedAddress, extractDiagnosticCode };
