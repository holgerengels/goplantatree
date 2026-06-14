#!/usr/bin/env node
/**
 * Seed default mail templates.
 * 
 * Usage (local, from homepage/):
 *   node backend/scripts/seed-mail-templates.js              (dry-run)
 *   node backend/scripts/seed-mail-templates.js --apply       (actually insert)
 * 
 * Usage (in Docker):
 *   docker exec goplantatree-app node /app/scripts/seed-mail-templates.js --apply
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import MailTemplate from '../src/models/MailTemplate.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';
const apply = process.argv.includes('--apply');

const defaultTemplates = [
    {
        slug: 'subscribe-confirm',
        name: 'Newsletter-Bestätigung',
        type: 'transactional',
        project: null,
        subject: '🌳 Bitte bestätige deine Anmeldung',
        html: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #2E5641;">Anmeldung bestätigen</h2>
    <p>Hallo {{name}},</p>
    <p>bitte bestätige deine Newsletter-Anmeldung mit einem Klick auf den folgenden Link:</p>
    <p style="margin: 24px 0;">
        <a href="{{confirm_url}}" style="background: #2E5641; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            ✅ Anmeldung bestätigen
        </a>
    </p>
    <p style="color: #888; font-size: 12px;">Falls du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.</p>
</div>`,
        variables: ['name', 'email', 'project', 'confirm_url'],
        active: true
    },
    {
        slug: 'newsletter',
        name: 'Newsletter Standard',
        type: 'newsletter',
        project: null,
        subject: '🌳 Neuigkeiten von Go Plant A Tree',
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2E5641; margin: 0;">🌳 Go Plant A Tree</h1>
    </div>

    <p>Hallo {{name}},</p>

    <p>Hier sind unsere neuesten Nachrichten:</p>

    <!-- Inhalt hier einfügen -->

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

    <p style="color: #888; font-size: 12px; text-align: center;">
        Du erhältst diese E-Mail, weil du dich für unseren Newsletter angemeldet hast.<br />
        <a href="{{unsubscribe_url}}" style="color: #888;">Abmelden</a>
    </p>
</div>`,
        variables: ['name', 'email', 'project', 'topic', 'unsubscribe_url', 'data.xxx'],
        active: true
    }
];

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to ${MONGO_URI}`);

    for (const tpl of defaultTemplates) {
        const existing = await MailTemplate.findOne({ slug: tpl.slug, project: tpl.project });
        if (existing) {
            console.log(`  ⏭  Template "${tpl.slug}" (project: ${tpl.project || 'global'}) already exists — skipping`);
        } else {
            console.log(`  ✅ Creating template "${tpl.slug}" (project: ${tpl.project || 'global'})`);
            if (apply) {
                await MailTemplate.create(tpl);
            }
        }
    }

    if (!apply) {
        console.log('\n⚠  Dry-run — no changes made. Use --apply to insert templates.');
    } else {
        console.log('\n✅ Done!');
    }

    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
