// Migration: Replace [[media id=<ObjectId>]] with [[media id=<slug>]] in post/page content.
//
// How to run locally:
//   docker cp ./scripts/migrate-media-shortcodes.js mongodb:/tmp/migrate-media-shortcodes.js
//   docker exec mongodb mongosh goplantatree --username admin --password password --authenticationDatabase admin --file /tmp/migrate-media-shortcodes.js
//
// How to run on the production server:
//   scp ./scripts/migrate-media-shortcodes.js user@server:/tmp/
//   ssh user@server "docker cp /tmp/migrate-media-shortcodes.js goplantatree-mongo:/tmp/migrate-media-shortcodes.js && docker exec goplantatree-mongo mongosh goplantatree --file /tmp/migrate-media-shortcodes.js"

print('=== MEDIA SHORTCODE MIGRATION ===\n');
print('Replacing [[media id=<ObjectId>]] → [[media id=<slug>]]\n');

// Step 1: Build ObjectId → slug lookup from media collection
const mediaMap = {};
db.media.find({ slug: { $exists: true, $ne: null }, $expr: { $gt: [{ $strLenCP: '$slug' }, 0] } }).forEach(m => {
    mediaMap[m._id.toString()] = m.slug;
});
print(`Media lookup: ${Object.keys(mediaMap).length} entries with slugs\n`);

// Step 2: Find and replace in posts and pages
// Pattern matches: [[media id=<24-char hex>]] with optional extra attributes
const hexPattern = /\[\[media(\s+[^\]]*?)id=([0-9a-fA-F]{24})([^\]]*?)\]\]/g;

let totalUpdated = 0;
let totalReplaced = 0;
let totalNotFound = 0;

for (const collName of ['posts', 'pages']) {
    const docs = db[collName].find({
        content: { $regex: /\[\[media\s[^\]]*id=[0-9a-fA-F]{24}/ }
    }).toArray();

    let collUpdated = 0;
    let collReplaced = 0;

    for (const doc of docs) {
        let content = doc.content;
        let changed = false;

        content = content.replace(hexPattern, (match, before, objectId, after) => {
            const slug = mediaMap[objectId];
            if (slug) {
                changed = true;
                collReplaced++;
                return `[[media${before}id="${slug}"${after}]]`;
            }
            print(`  ⚠ ${collName}/${doc.slug || doc.title}: ObjectId ${objectId} not found in media collection`);
            totalNotFound++;
            return match;
        });

        if (changed) {
            db[collName].updateOne({ _id: doc._id }, { $set: { content } });
            collUpdated++;
            print(`  ✓ ${collName}/${doc.slug || doc.title}: updated`);
        }
    }

    totalUpdated += collUpdated;
    totalReplaced += collReplaced;
    print(`${collName}: ${collUpdated} documents updated, ${collReplaced} references replaced\n`);
}

// Step 3: Verification
print('=== VERIFICATION ===\n');
let remaining = 0;
for (const collName of ['posts', 'pages']) {
    const count = db[collName].countDocuments({
        content: { $regex: /\[\[media\s[^\]]*id=[0-9a-fA-F]{24}/ }
    });
    print(`${collName} with ObjectId media refs remaining: ${count}`);
    remaining += count;
}

print('');
if (remaining === 0) {
    print(`✅ Migration erfolgreich! ${totalReplaced} Referenzen in ${totalUpdated} Dokumenten migriert.`);
} else {
    print(`❌ ${remaining} Dokumente haben noch ObjectId-Referenzen!`);
}
if (totalNotFound > 0) {
    print(`⚠ ${totalNotFound} ObjectIds konnten keinem Media-Slug zugeordnet werden.`);
}
