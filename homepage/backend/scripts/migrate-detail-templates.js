/**
 * Migration: Create detail template pages ("detail-<entity-slug>")
 *
 * Usage (prod):  docker exec goplantatree-app node scripts/migrate-detail-templates.js
 * Usage (local): node scripts/migrate-detail-templates.js
 *
 * Entity detail views (/baeume/:slug, /blog/:slug, /angebote/:project/:slug) are rendered
 * from these pages. Placeholders: {{field}}, {{field|date}}; macro [[fields keys="…"]].
 *
 * Idempotent: only creates missing pages — existing (possibly edited) pages are left untouched.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const templates = [
    {
        slug: 'detail-baeume',
        title: '{{name}}',
        template: true,
        content: `[[media id="{{image}}"]]
<p><em>{{summary}}</em></p>
[[fields keys="category,sizeCategory,height,width,flowering,fruit,location,growthForm,properties" title="Steckbrief"]]
{{description}}`
    },
    {
        slug: 'detail-blog',
        title: '{{title}}',
        template: true,
        content: `[[fields keys="publishedAt|date,author,project"]]
[[media id="{{image}}"]]
<p><em>{{excerpt}}</em></p>
{{content}}`
    },
    {
        slug: 'detail-angebote',
        title: '{{name}}',
        template: true,
        content: `<p><em>{{bezeichnungBotanisch}}</em></p>
[[offerings project="{{project}}" slug="{{slug}}"]]
[[project-action project="{{project}}"]]`
    }
];

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const pages = mongoose.connection.collection('pages');
    for (const t of templates) {
        const now = new Date();
        const res = await pages.updateOne(
            { slug: t.slug },
            { $setOnInsert: { ...t, project: null, published: true, template: true, createdAt: now, updatedAt: now } },
            { upsert: true }
        );
        console.log(res.upsertedCount ? `✅ ${t.slug} angelegt` : `⏭️  ${t.slug} existiert bereits — unverändert`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Migration complete!');
    process.exit(0);
} catch (err) {
    console.error('❌ Migration error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
}
