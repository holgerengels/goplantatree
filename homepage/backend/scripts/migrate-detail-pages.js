#!/usr/bin/env node
/**
 * Migration: Prepare production MongoDB for harmonized Blog, Pflanzblog, and Bäume structure.
 *
 * Changes applied:
 *   1. Templates:
 *      - detail-post → detail-blog (template: true)
 *      - detail-baeume (stays detail-baeume, flagged with template: true)
 *      - detail-angebote (flagged with template: true)
 *      - All pages with slug "detail-*" receive template: true
 *   2. List pages:
 *      - Ensures "pflanzblog" exists with [[post-submit type="pflanzung"]] and [[posts type="pflanzung"]]
 *      - Ensures "baeume" list page exists with [[trees]]
 *      - Ensures "blog" list page exists with [[posts limit=12]] if missing
 *   3. Links:
 *      - Replaces legacy /post/:slug with /blog/:slug in pages content
 *
 * Usage locally:
 *   cd homepage/scripts && node migrate-detail-pages.js
 *   # oder:
 *   cd homepage/backend && npm run migrate:pages
 *
 * Usage in container:
 *   docker exec goplantatree-app node scripts/migrate-detail-pages.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

let __dirname = process.cwd();
try {
    if (import.meta.url && import.meta.url.startsWith('file:')) {
        __dirname = path.dirname(fileURLToPath(import.meta.url));
    }
} catch (_) {}

// Locate backend directory containing package.json and node_modules
let backendPath = path.resolve(__dirname, '../backend');
if (!fs.existsSync(backendPath) || !fs.existsSync(path.join(backendPath, 'package.json'))) {
    let currentDir = __dirname;
    backendPath = __dirname;
    while (true) {
        if (fs.existsSync(path.join(currentDir, 'package.json')) && fs.existsSync(path.join(currentDir, 'node_modules', 'mongoose'))) {
            backendPath = currentDir;
            break;
        }
        const parent = path.dirname(currentDir);
        if (parent === currentDir) break;
        currentDir = parent;
    }
}

// Resolve dependencies via backend require so running from scripts/ works without root node_modules
const backendRequire = createRequire(path.resolve(backendPath, 'server.js'));
const mongoose = backendRequire('mongoose');
const dotenv = backendRequire('dotenv');

// Load .env
dotenv.config({ path: path.resolve(backendPath, '.env') });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ||
    (process.env.NODE_ENV === 'production'
        ? 'mongodb://goplantatree-mongo:27017/goplantatree'
        : 'mongodb://admin:password@localhost:27017/goplantatree?authSource=admin');

async function migrate() {
    console.log('🔄 Starting detail & list pages migration...');
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const pages = db.collection('pages');
    const now = new Date();

    // 1. Rename detail-post → detail-blog
    const oldPost = await pages.findOne({ slug: 'detail-post' });
    const existingBlog = await pages.findOne({ slug: 'detail-blog' });

    if (oldPost && !existingBlog) {
        await pages.updateOne({ _id: oldPost._id }, { $set: { slug: 'detail-blog', template: true, updatedAt: now } });
        console.log('✅ Renamed template: detail-post → detail-blog (template: true)');
    } else if (existingBlog) {
        await pages.updateOne({ _id: existingBlog._id }, { $set: { template: true, updatedAt: now } });
        console.log('⏭️  Template detail-blog already exists — flagged with template: true.');
    } else {
        await pages.insertOne({
            slug: 'detail-blog',
            title: '{{title}}',
            heroSubtitle: '',
            content: `[[fields keys="publishedAt|date,author,project"]]\n[[media id="{{image}}"]]\n<p><em>{{excerpt}}</em></p>\n{{content}}`,
            project: null,
            published: true,
            template: true,
            createdAt: now,
            updatedAt: now
        });
        console.log('✅ Created default template: detail-blog (template: true)');
    }

    // 2. Ensure detail-baeume exists and has template: true
    const existingBaeume = await pages.findOne({ slug: 'detail-baeume' });
    if (existingBaeume) {
        await pages.updateOne({ _id: existingBaeume._id }, { $set: { template: true, updatedAt: now } });
        console.log('✅ Template detail-baeume confirmed (template: true)');
    } else {
        await pages.insertOne({
            slug: 'detail-baeume',
            title: '{{name}}',
            heroSubtitle: '',
            content: `[[media id="{{image}}"]]\n<p><em>{{summary}}</em></p>\n[[fields keys="category,sizeCategory,height,width,flowering,fruit,location,growthForm,properties" title="Steckbrief"]]\n{{description}}`,
            project: null,
            published: true,
            template: true,
            createdAt: now,
            updatedAt: now
        });
        console.log('✅ Created default template: detail-baeume (template: true)');
    }

    // 3. Flag all other detail-* pages with template: true
    const detailPagesResult = await pages.updateMany(
        { slug: { $regex: '^detail-' } },
        { $set: { template: true } }
    );
    console.log(`🏷️  Flagged ${detailPagesResult.modifiedCount} page(s) matching detail-* with template: true`);

    // 4. Ensure pflanzblog page exists and has [[post-submit]]
    const pflanzblogPage = await pages.findOne({ slug: 'pflanzblog' });
    if (!pflanzblogPage) {
        await pages.insertOne({
            slug: 'pflanzblog',
            title: 'Pflanzblog',
            heroSubtitle: 'Berichte & Fotos von Pflanzaktionen',
            content: `<p>Hier berichten Baumpatinnen und Baumpaten von ihren Pflanzungen.</p>\n[[post-submit type="pflanzung"]]\n[[posts type="pflanzung" limit=12]]`,
            project: null,
            published: true,
            template: false,
            createdAt: now,
            updatedAt: now
        });
        console.log('✅ Created list page: pflanzblog');
    } else {
        let content = pflanzblogPage.content || '';
        let needsUpdate = false;
        if (!content.includes('post-submit')) {
            content = content + '\n[[post-submit type="pflanzung"]]';
            needsUpdate = true;
            console.log('✅ Appended [[post-submit type="pflanzung"]] to pflanzblog page');
        }
        if (!content.includes('[[posts') && !content.includes('[[blog')) {
            content = content + '\n[[posts type="pflanzung" limit=12]]';
            needsUpdate = true;
            console.log('✅ Appended [[posts type="pflanzung"]] to pflanzblog page');
        }
        if (pflanzblogPage.template) {
            needsUpdate = true;
        }
        if (needsUpdate) {
            await pages.updateOne({ _id: pflanzblogPage._id }, { $set: { content, template: false, updatedAt: now } });
        } else {
            console.log('⏭️  Page pflanzblog already up to date.');
        }
    }

    // 5. Ensure baeume list page exists
    const baeumePage = await pages.findOne({ slug: 'baeume' });
    if (!baeumePage) {
        await pages.insertOne({
            slug: 'baeume',
            title: 'Bäume',
            heroSubtitle: 'Unsere Baumarten im Überblick',
            content: '<section class="section-surface">\n[[trees]]\n</section>',
            project: null,
            published: true,
            template: false,
            createdAt: now,
            updatedAt: now
        });
        console.log('✅ Created list page: baeume');
    } else {
        console.log('⏭️  List page baeume already exists.');
    }

    // 6. Ensure blog list page exists
    const blogPage = await pages.findOne({ slug: 'blog' });
    const aktuellesPage = await pages.findOne({ slug: 'aktuelles' });
    if (!blogPage && !aktuellesPage) {
        await pages.insertOne({
            slug: 'blog',
            title: 'Blog',
            heroSubtitle: 'Aktuelles & Wissenswertes rund um GoPlantATree',
            content: '<section class="section-surface">\n[[posts limit=12]]\n</section>',
            project: null,
            published: true,
            template: false,
            createdAt: now,
            updatedAt: now
        });
        console.log('✅ Created list page: blog');
    } else {
        console.log('⏭️  List page blog/aktuelles already exists.');
    }

    // 7. Update internal links in pages content (/post/ → /blog/)
    const cursor = pages.find({
        content: { $regex: '/post/' }
    });

    let updatedCount = 0;
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        let newContent = doc.content;
        if (newContent) {
            newContent = newContent.replace(/\/post\//g, '/blog/');
            if (newContent !== doc.content) {
                await pages.updateOne({ _id: doc._id }, { $set: { content: newContent, updatedAt: now } });
                console.log(`🔗 Updated internal links in page: "${doc.slug}"`);
                updatedCount++;
            }
        }
    }
    console.log(`✅ Links updated in ${updatedCount} page(s).`);

    await mongoose.disconnect();
    console.log('\n🎉 Migration completed successfully!');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
