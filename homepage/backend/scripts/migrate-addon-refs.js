/**
 * Migrate offering addon references from embedded objects to slug strings.
 *
 * Some offerings store addons as objects: [{ name: "Wühlmauskorb", description: "..." }]
 * Others correctly use slugs: ["wuehlmauskorb"]
 *
 * This script normalizes all to slug strings by looking up addon names.
 *
 * Usage:
 *   docker exec goplantatree-mongo mongosh "mongodb://localhost:27017/goplantatree" --quiet --file /tmp/migrate-addon-refs.js
 *
 * Or copy-paste the eval block below into mongosh.
 */

// ─── Run in mongosh ─────────────────────────────────────────

// Build name → slug lookup from addons collection
const addonLookup = {};
db.addons.find({}, { name: 1, slug: 1, _id: 0 }).forEach(a => {
    addonLookup[a.name] = a.slug;
});
print('Addon lookup: ' + JSON.stringify(addonLookup));

// Find offerings with addons that contain objects (not strings)
const offerings = db.offerings.find({
    addons: { $exists: true, $ne: [] }
}).toArray();

let updated = 0;
let skipped = 0;
let errors = 0;

offerings.forEach(offering => {
    const currentAddons = offering.addons || [];

    // Check if any addon is an object (needs migration)
    const needsMigration = currentAddons.some(a => typeof a === 'object' && a !== null);
    if (!needsMigration) {
        skipped++;
        return;
    }

    // Convert all addons to slugs
    const newAddons = currentAddons.map(addon => {
        if (typeof addon === 'string') return addon; // already a slug

        // Object format: { name: "Wühlmauskorb", description: "..." }
        const slug = addonLookup[addon.name];
        if (!slug) {
            print('⚠️  No addon found for name: ' + addon.name + ' (offering: ' + offering.slug + ')');
            errors++;
            return null;
        }
        return slug;
    }).filter(Boolean);

    // Update the offering
    const result = db.offerings.updateOne(
        { _id: offering._id },
        { $set: { addons: newAddons } }
    );

    if (result.modifiedCount > 0) {
        print('✅ ' + offering.slug + ': ' + JSON.stringify(currentAddons.map(a => typeof a === 'string' ? a : a.name)) + ' → ' + JSON.stringify(newAddons));
        updated++;
    }
});

print('\n── Ergebnis ──');
print('Migriert:    ' + updated);
print('Übersprungen: ' + skipped + ' (bereits Slugs)');
print('Fehler:      ' + errors);
