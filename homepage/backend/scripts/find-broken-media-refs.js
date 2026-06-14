/**
 * Find broken media references in tree descriptions.
 * Checks which [[media id="..."]] macros reference non-existent slugs,
 * and tries to map them to existing media by _id.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

const trees = await db.collection('trees').find({}).toArray();
const allMedia = await db.collection('media').find({}, { projection: { _id: 1, slug: 1, title: 1, originalName: 1, filename: 1 } }).toArray();

// Build lookup maps
const slugSet = new Set(allMedia.map(m => m.slug).filter(Boolean));
const idToMedia = new Map();
for (const m of allMedia) {
    idToMedia.set(m._id.toString(), m);
}

console.log(`\n📊 Insgesamt ${trees.length} Bäume, ${allMedia.length} Medien\n`);

const macroRegex = /\[\[media\s+id="([^"]+)"[^\]]*\]\]/g;
let brokenCount = 0;
let fixableCount = 0;

for (const tree of trees) {
    const desc = tree.description || '';
    let match;
    macroRegex.lastIndex = 0;
    
    while ((match = macroRegex.exec(desc)) !== null) {
        const refId = match[1];
        
        if (slugSet.has(refId)) {
            // This reference works fine (slug exists)
            continue;
        }
        
        brokenCount++;
        
        // Try to find by _id
        const mediaById = idToMedia.get(refId);
        
        if (mediaById) {
            fixableCount++;
            console.log(`🔧 FIXABLE: Baum "${tree.name}" (slug: ${tree.slug})`);
            console.log(`   Referenz: [[media id="${refId}"]]`);
            console.log(`   → Medium gefunden per _id: slug="${mediaById.slug}", title="${mediaById.title || mediaById.originalName}"`);
            console.log(`   → Fix: id="${refId}" → id="${mediaById.slug}"`);
            console.log();
        } else {
            console.log(`❌ BROKEN: Baum "${tree.name}" (slug: ${tree.slug})`);
            console.log(`   Referenz: [[media id="${refId}"]]`);
            console.log(`   → Kein Medium mit slug="${refId}" und keine _id="${refId}" gefunden`);
            console.log();
        }
    }
}

console.log(`\n📋 Zusammenfassung:`);
console.log(`   Kaputte Referenzen: ${brokenCount}`);
console.log(`   Davon fixbar (ID → Slug): ${fixableCount}`);
console.log(`   Nicht zuordnbar: ${brokenCount - fixableCount}`);

await mongoose.disconnect();
