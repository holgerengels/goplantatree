// Migration: Add slugs to offerings, trees, and media that don't have one yet.
//
// How to run locally (PowerShell):
//   docker cp .\scripts\migrate-add-slugs.js mongodb:/tmp/migrate-add-slugs.js
//   docker exec mongodb mongosh goplantatree --username admin --password password --authenticationDatabase admin --file /tmp/migrate-add-slugs.js
//
// How to run on the production server:
//   scp ./migrate-add-slugs.js user@server:/tmp/
//   ssh user@server "docker cp /tmp/migrate-add-slugs.js goplantatree-mongo:/tmp/migrate-add-slugs.js && docker exec goplantatree-mongo mongosh goplantatree --file /tmp/migrate-add-slugs.js"

function slugify(str) {
    if (!str) return '';
    return str
        .replace(/ä/gi, 'ae')
        .replace(/ö/gi, 'oe')
        .replace(/ü/gi, 'ue')
        .replace(/ß/g, 'ss')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

print('=== SLUG MIGRATION ===\n');

// ─── 1. OFFERINGS ───────────────────────────────────────────────
print('--- Offerings ---');
let offeringsMigrated = 0;
let offeringsSkipped = 0;

db.offerings.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).forEach(offering => {
    const baseSlug = slugify(offering.name);
    if (!baseSlug) {
        print(`  ⚠ Offering "${offering.name}" (_id: ${offering._id}) — Name ergibt keinen gültigen Slug, übersprungen`);
        offeringsSkipped++;
        return;
    }

    // Deduplicate within same project
    let candidate = baseSlug;
    let counter = 2;
    while (db.offerings.findOne({ project: offering.project, slug: candidate, _id: { $ne: offering._id } })) {
        candidate = `${baseSlug}-${counter++}`;
    }

    db.offerings.updateOne({ _id: offering._id }, { $set: { slug: candidate } });
    print(`  ✓ ${offering.name} → ${candidate}`);
    offeringsMigrated++;
});

print(`  Migriert: ${offeringsMigrated}, Übersprungen: ${offeringsSkipped}\n`);

// ─── 2. TREES ───────────────────────────────────────────────────
print('--- Trees ---');
let treesMigrated = 0;
let treesSkipped = 0;

db.trees.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).forEach(tree => {
    const baseSlug = slugify(tree.name);
    if (!baseSlug) {
        print(`  ⚠ Tree "${tree.name}" (_id: ${tree._id}) — Name ergibt keinen gültigen Slug, übersprungen`);
        treesSkipped++;
        return;
    }

    // Deduplicate globally
    let candidate = baseSlug;
    let counter = 2;
    while (db.trees.findOne({ slug: candidate, _id: { $ne: tree._id } })) {
        candidate = `${baseSlug}-${counter++}`;
    }

    db.trees.updateOne({ _id: tree._id }, { $set: { slug: candidate } });
    print(`  ✓ ${tree.name} → ${candidate}`);
    treesMigrated++;
});

print(`  Migriert: ${treesMigrated}, Übersprungen: ${treesSkipped}\n`);

// ─── 3. MEDIA ───────────────────────────────────────────────────
print('--- Media ---');
let mediaMigrated = 0;
let mediaSkipped = 0;

db.media.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).forEach(media => {
    // Derive from originalName, strip file extension
    const nameWithoutExt = (media.originalName || '').replace(/\.[^.]+$/, '');
    const baseSlug = slugify(nameWithoutExt);
    if (!baseSlug) {
        print(`  ⚠ Media "${media.originalName}" (_id: ${media._id}) — Name ergibt keinen gültigen Slug, übersprungen`);
        mediaSkipped++;
        return;
    }

    // Deduplicate globally
    let candidate = baseSlug;
    let counter = 2;
    while (db.media.findOne({ slug: candidate, _id: { $ne: media._id } })) {
        candidate = `${baseSlug}-${counter++}`;
    }

    db.media.updateOne({ _id: media._id }, { $set: { slug: candidate } });
    mediaMigrated++;
});

print(`  Migriert: ${mediaMigrated}, Übersprungen: ${mediaSkipped}\n`);

// ─── VERIFICATION ───────────────────────────────────────────────
print('=== VERIFICATION ===\n');
let allGood = true;

// Check: Offerings without slug
const offeringsNoSlug = db.offerings.countDocuments({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
print(`Offerings ohne Slug: ${offeringsNoSlug}`);
if (offeringsNoSlug > 0) allGood = false;

// Check: Offering slug duplicates (per project)
const offeringDupes = db.offerings.aggregate([
    { $match: { slug: { $exists: true, $ne: null } } },
    { $group: { _id: { project: '$project', slug: '$slug' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
]).toArray();
print(`Offering-Slug-Duplikate (pro Projekt): ${offeringDupes.length}`);
offeringDupes.forEach(d => print(`  ⚠ "${d._id.slug}" in Projekt ${d._id.project} → ${d.count}x`));
if (offeringDupes.length > 0) allGood = false;

// Check: Trees without slug
const treesNoSlug = db.trees.countDocuments({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
print(`Trees ohne Slug: ${treesNoSlug}`);
if (treesNoSlug > 0) allGood = false;

// Check: Tree slug duplicates
const treeDupes = db.trees.aggregate([
    { $match: { slug: { $exists: true, $ne: null } } },
    { $group: { _id: '$slug', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
]).toArray();
print(`Tree-Slug-Duplikate: ${treeDupes.length}`);
treeDupes.forEach(d => print(`  ⚠ "${d._id}" → ${d.count}x`));
if (treeDupes.length > 0) allGood = false;

// Check: Media without slug
const mediaNoSlug = db.media.countDocuments({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
print(`Media ohne Slug: ${mediaNoSlug}`);
if (mediaNoSlug > 0) allGood = false;

// Check: Media slug duplicates
const mediaDupes = db.media.aggregate([
    { $match: { slug: { $exists: true, $ne: null } } },
    { $group: { _id: '$slug', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
]).toArray();
print(`Media-Slug-Duplikate: ${mediaDupes.length}`);
mediaDupes.forEach(d => print(`  ⚠ "${d._id}" → ${d.count}x`));
if (mediaDupes.length > 0) allGood = false;

print('');
if (allGood) {
    print('✅ Alle Slugs vollständig und eindeutig! Deploy kann erfolgen.');
} else {
    print('❌ FEHLER — Bitte Probleme beheben vor dem Deploy!');
}
