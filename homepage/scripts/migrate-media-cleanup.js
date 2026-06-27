/**
 * Cleanup Script: Ensure all media references are slug strings
 * 
 * Scans every collection for media fields that still contain objects or ObjectIds
 * instead of slug strings. Converts them to slugs or flags them.
 * 
 * Usage:
 *   docker cp scripts/migrate-media-cleanup.js gpt-backend:/app/
 *   docker exec gpt-backend node /app/migrate-media-cleanup.js              # Dry run
 *   docker exec gpt-backend node /app/migrate-media-cleanup.js --execute    # Apply changes
 * 
 * IMPORTANT: Create a backup before running with --execute!
 *   docker exec gpt-mongo mongodump --db goplantatree --out /backup/pre-media-cleanup
 * 
 * Env: MONGODB_URI (default: mongodb://mongo:27017/goplantatree)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let backendPath = path.resolve(__dirname, '../backend');
if (!fs.existsSync(backendPath) || !fs.existsSync(path.join(backendPath, 'package.json'))) {
    let currentDir = __dirname;
    backendPath = __dirname;
    while (true) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            backendPath = currentDir;
            break;
        }
        const parent = path.dirname(currentDir);
        if (parent === currentDir) break;
        currentDir = parent;
    }
}

const backendRequire = createRequire(path.resolve(backendPath, 'server.js'));
const mongoose = backendRequire('mongoose');
const dotenv = backendRequire('dotenv');

dotenv.config({ path: path.resolve(backendPath, '.env') });
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/goplantatree';
const DRY_RUN = !process.argv.includes('--execute');

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB: ${MONGO_URI}`);
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be written\n' : '⚡ EXECUTE MODE — changes will be written\n');

    const db = mongoose.connection.db;

    // ──────────────────────────────────────────
    // Build media lookup: ObjectId → slug
    // ──────────────────────────────────────────
    const mediaById = {};
    for (const m of await db.collection('media').find({}).toArray()) {
        if (m.slug) {
            mediaById[m._id.toString()] = m.slug;
        }
    }
    console.log(`Media lookup: ${Object.keys(mediaById).length} entries\n`);

    const summary = { checked: 0, needsUpdate: 0, updated: 0, errors: [] };

    /**
     * Resolve a media value to a slug string.
     * Returns { slug, changed } or null if unresolvable.
     */
    function resolveToSlug(value) {
        if (value === null || value === undefined) return null;

        // Already a slug string
        if (typeof value === 'string') return { slug: value, changed: false };

        // ObjectId
        if (typeof value === 'object' && value._bsontype === 'ObjectID' || value.constructor?.name === 'ObjectId') {
            const slug = mediaById[value.toString()];
            return slug ? { slug, changed: true } : null;
        }

        // Object with _id (populated reference)
        if (typeof value === 'object' && value._id) {
            const slug = value.slug || mediaById[value._id.toString()];
            return slug ? { slug, changed: true } : null;
        }

        // Object with url but no slug (old format)
        if (typeof value === 'object' && value.url) {
            const slug = mediaById[value._id?.toString()];
            return slug ? { slug, changed: true } : null;
        }

        return null;
    }

    // ──────────────────────────────────────────
    // 1. Top-level media fields
    // ──────────────────────────────────────────
    console.log('═══ Top-level media fields ═══');

    const TOP_LEVEL_MEDIA = [
        { collection: 'posts', field: 'image' },
        { collection: 'pages', field: 'image' },
        { collection: 'trees', field: 'image' },
        { collection: 'offerings', field: 'image' },
    ];

    for (const { collection, field } of TOP_LEVEL_MEDIA) {
        const coll = db.collection(collection);
        const docs = await coll.find({ [field]: { $exists: true, $ne: null } }).toArray();

        let changed = 0;
        let ok = 0;

        for (const doc of docs) {
            summary.checked++;
            const val = doc[field];

            if (typeof val === 'string') {
                ok++;
                continue;
            }

            // Not a string — needs migration
            const resolved = resolveToSlug(val);
            summary.needsUpdate++;

            if (resolved) {
                console.log(`  ⚠ ${collection}[${doc._id}].${field}: ${typeof val === 'object' ? JSON.stringify(val).substring(0, 80) : val} → "${resolved.slug}"`);
                if (!DRY_RUN) {
                    await coll.updateOne({ _id: doc._id }, { $set: { [field]: resolved.slug } });
                    summary.updated++;
                }
                changed++;
            } else {
                const desc = typeof val === 'object' ? JSON.stringify(val).substring(0, 100) : String(val);
                console.log(`  ✗ ${collection}[${doc._id}].${field}: UNRESOLVABLE — ${desc}`);
                summary.errors.push(`${collection}[${doc._id}].${field}`);
            }
        }

        console.log(`  ${collection}.${field}: ${ok} ok, ${changed} need update (${docs.length} total)`);
    }

    // ──────────────────────────────────────────
    // 2. Nested media fields in project content
    // ──────────────────────────────────────────
    console.log('\n═══ Nested media fields in project.content ═══');

    const NESTED_MEDIA = [
        { arrayPath: 'content.sponsors', field: 'logo' },
        { arrayPath: 'content.team', field: 'avatar' },
    ];

    const projects = await db.collection('projects').find({}).toArray();

    for (const project of projects) {
        for (const { arrayPath, field } of NESTED_MEDIA) {
            const pathParts = arrayPath.split('.');
            const arr = pathParts.reduce((obj, key) => obj?.[key], project);

            if (!Array.isArray(arr) || arr.length === 0) continue;

            let dirty = false;

            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (!item || item[field] === undefined || item[field] === null) continue;

                summary.checked++;
                const val = item[field];

                if (typeof val === 'string') continue; // Already OK

                const resolved = resolveToSlug(val);
                summary.needsUpdate++;

                if (resolved) {
                    console.log(`  ⚠ projects[${project._id}].${arrayPath}[${i}].${field}: ${typeof val === 'object' ? JSON.stringify(val).substring(0, 80) : val} → "${resolved.slug}"`);
                    arr[i] = { ...item, [field]: resolved.slug };
                    dirty = true;
                } else {
                    const desc = typeof val === 'object' ? JSON.stringify(val).substring(0, 100) : String(val);
                    console.log(`  ✗ projects[${project._id}].${arrayPath}[${i}].${field}: UNRESOLVABLE — ${desc}`);
                    summary.errors.push(`projects[${project._id}].${arrayPath}[${i}].${field}`);
                }
            }

            if (dirty && !DRY_RUN) {
                await db.collection('projects').updateOne(
                    { _id: project._id },
                    { $set: { [arrayPath]: arr } }
                );
                summary.updated++;
            }
        }
    }

    // ──────────────────────────────────────────
    // 3. Check for stale media ObjectId URLs in HTML content
    // ──────────────────────────────────────────
    console.log('\n═══ Stale ObjectId URLs in HTML content ═══');

    for (const collectionName of ['pages', 'posts']) {
        const coll = db.collection(collectionName);
        const docs = await coll.find({
            content: { $exists: true, $ne: null }
        }).toArray();

        for (const doc of docs) {
            if (typeof doc.content !== 'string') continue;
            const matches = doc.content.match(/\/api\/v1\/media\/([0-9a-fA-F]{24})\/file/g);
            if (matches) {
                console.log(`  ⚠ ${collectionName}[${doc._id}]: ${matches.length} stale ObjectId URL(s) in content`);

                if (!DRY_RUN) {
                    let content = doc.content;
                    let changed = false;
                    content = content.replace(/\/api\/v1\/media\/([0-9a-fA-F]{24})\/file/g, (match, id) => {
                        const slug = mediaById[id];
                        if (slug) {
                            changed = true;
                            return `/api/v1/media/by-slug/${slug}/file`;
                        }
                        console.log(`    ✗ ObjectId ${id} not found in media lookup`);
                        return match;
                    });
                    if (changed) {
                        await coll.updateOne({ _id: doc._id }, { $set: { content } });
                        summary.updated++;
                    }
                }
            }
        }
    }

    // ──────────────────────────────────────────
    // 4. Check for [[media id="ObjectId"]] macros with ObjectIds
    // ──────────────────────────────────────────
    console.log('\n═══ Stale ObjectId macro references in HTML content ═══');

    for (const collectionName of ['pages', 'posts']) {
        const coll = db.collection(collectionName);
        const docs = await coll.find({
            content: { $exists: true, $ne: null }
        }).toArray();

        for (const doc of docs) {
            if (typeof doc.content !== 'string') continue;
            const macroMatches = [...doc.content.matchAll(/\[\[media\s+id="([0-9a-fA-F]{24})"\]\]/g)];
            if (macroMatches.length > 0) {
                console.log(`  ⚠ ${collectionName}[${doc._id}]: ${macroMatches.length} stale ObjectId macro(s)`);

                if (!DRY_RUN) {
                    let content = doc.content;
                    let changed = false;
                    content = content.replace(/\[\[media\s+id="([0-9a-fA-F]{24})"\]\]/g, (match, id) => {
                        const slug = mediaById[id];
                        if (slug) {
                            changed = true;
                            return `[[media id="${slug}"]]`;
                        }
                        console.log(`    ✗ ObjectId ${id} not found in media lookup`);
                        return match;
                    });
                    if (changed) {
                        await coll.updateOne({ _id: doc._id }, { $set: { content } });
                        summary.updated++;
                    }
                }
            }
        }
    }

    // ──────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log(DRY_RUN ? '   DRY RUN COMPLETE' : '   MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`  Checked:      ${summary.checked}`);
    console.log(`  Needs update: ${summary.needsUpdate}`);
    if (!DRY_RUN) {
        console.log(`  Updated:      ${summary.updated}`);
    }
    if (summary.errors.length > 0) {
        console.log(`  Errors:       ${summary.errors.length}`);
        for (const e of summary.errors) {
            console.log(`    ✗ ${e}`);
        }
    }

    if (DRY_RUN && summary.needsUpdate > 0) {
        console.log('\n→ Run with --execute to apply changes');
    }

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
