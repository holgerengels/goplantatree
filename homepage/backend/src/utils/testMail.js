/**
 * Quick test script: send a test mail via sendMail().
 * Usage: node src/utils/testMail.js <account> <to-address>
 * Example: node src/utils/testMail.js klimabaumaktion-ulm holger@example.com
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { sendMail, verifyConnection } from './mailService.js';

const account = process.argv[2] || 'info';
const to = process.argv[3];

if (!to) {
    console.error('Usage: node src/utils/testMail.js <account> <to-address>');
    console.error('  Accounts: info, klimabaumaktion-ulm, 100-baeume-bc');
    process.exit(1);
}

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`📧 Verifying SMTP connection for "${account}"...`);

    await verifyConnection(account);
    console.log('✅ SMTP connection OK\n');

    console.log(`📧 Sending test mail to ${to} via ${account}...`);
    const log = await sendMail(account, {
        to,
        subject: '🌳 Go Plant A Tree — Test-Mail',
        html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #2E5641;">✅ Mail-System funktioniert!</h2>
                <p>Diese Test-Mail wurde über das Konto <strong>${account}</strong> versendet.</p>
                <p style="color: #888; font-size: 12px;">Gesendet am ${new Date().toLocaleString('de-DE')}</p>
            </div>
        `,
        text: `Go Plant A Tree — Test-Mail. Gesendet über: ${account}`,
        template: 'test'
    });

    console.log(`\n📋 MailLog Eintrag:`);
    console.log(`   Status:   ${log.status}`);
    console.log(`   ID:       ${log._id}`);
    console.log(`   Response: ${log.smtpResponse || log.error}`);

    await mongoose.disconnect();
    process.exit(0);
} catch (err) {
    console.error('❌ Fehler:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
}
