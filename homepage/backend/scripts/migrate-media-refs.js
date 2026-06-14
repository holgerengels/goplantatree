/**
 * Migration: Fix broken media references in tree descriptions.
 * Replaces MongoDB _id references with the correct slug.
 * 
 * Usage:
 *   node scripts/migrate-media-refs.js          # Dry run (default)
 *   node scripts/migrate-media-refs.js --apply   # Apply changes
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dryRun = !process.argv.includes('--apply');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

const trees = await db.collection('trees').find({}).toArray();
const allMedia = await db.collection('media').find({}, { projection: { _id: 1, slug: 1 } }).toArray();

const slugSet = new Set(allMedia.map(m => m.slug).filter(Boolean));
const idToSlug = new Map();
for (const m of allMedia) {
    if (m.slug) idToSlug.set(m._id.toString(), m.slug);
}

console.log(dryRun ? '🔍 DRY RUN (use --apply to write changes)\n' : '✏️  APPLYING changes\n');

const macroRegex = /\[\[media\s+id="([^"]+)"([^\]]*)\]\]/g;
let fixedCount = 0;

for (const tree of trees) {
    const desc = tree.description || '';
    let newDesc = desc;
    let changed = false;

    newDesc = desc.replace(macroRegex, (full, refId, rest) => {
        if (slugSet.has(refId)) return full; // already a valid slug

        const slug = idToSlug.get(refId);
        if (slug) {
            changed = true;
            fixedCount++;
            console.log(`✅ ${tree.name}: "${refId}" → "${slug}"`);
            return `[[media id="${slug}"${rest}]]`;
        }
        return full;
    });

    if (changed && !dryRun) {
        await db.collection('trees').updateOne(
            { _id: tree._id },
            { $set: { description: newDesc } }
        );
    }
}

console.log(`\n📋 ${fixedCount} Referenzen ${dryRun ? 'würden gefixt' : 'gefixt'}.`);
await mongoose.disconnect();
