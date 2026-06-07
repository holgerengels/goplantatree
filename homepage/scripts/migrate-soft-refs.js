/**
 * Migration Script: ObjectId References → Slug-based Soft References
 * 
 * Converts all ObjectId references to slug strings across the entire database.
 * Also migrates media URLs in Page/Post content fields.
 * 
 * Usage:
 *   docker cp migrate-soft-refs.js gpt-backend:/app/
 *   docker exec gpt-backend node /app/migrate-soft-refs.js
 * 
 * IMPORTANT: Create a backup before running!
 *   docker exec gpt-mongo mongodump --db goplantatree --out /backup/pre-softref
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/goplantatree';

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);
    const db = mongoose.connection.db;

    // ──────────────────────────────────────────
    // Step 1: Build lookup maps (ObjectId → slug)
    // ──────────────────────────────────────────
    console.log('\n═══ Step 1: Building lookup maps ═══');

    const projectMap = {};
    const treeMap = {};
    const mediaMap = {};  // ObjectId → slug
    const mediaIdToSlug = {};  // ObjectId string → slug (for content migration)

    for (const p of await db.collection('projects').find({}).toArray()) {
        projectMap[p._id.toString()] = p.slug;
    }
    console.log(`  Projects: ${Object.keys(projectMap).length} entries`);

    for (const t of await db.collection('trees').find({}).toArray()) {
        treeMap[t._id.toString()] = t.slug;
    }
    console.log(`  Trees: ${Object.keys(treeMap).length} entries`);

    for (const m of await db.collection('media').find({}).toArray()) {
        if (m.slug) {
            mediaMap[m._id.toString()] = m.slug;
            mediaIdToSlug[m._id.toString()] = m.slug;
        }
    }
    console.log(`  Media: ${Object.keys(mediaMap).length} entries`);

    // ──────────────────────────────────────────
    // Step 2: Migrate ObjectId references
    // ──────────────────────────────────────────
    console.log('\n═══ Step 2: Migrating references ═══');

    const stats = {};

    async function migrateField(collectionName, field, lookupMap) {
        const collection = db.collection(collectionName);
        const docs = await collection.find({
            [field]: { $exists: true, $ne: null }
        }).toArray();

        let updated = 0;
        let skipped = 0;
        let notFound = 0;

        for (const doc of docs) {
            const val = doc[field];
            
            // Skip if already a string (already migrated)
            if (typeof val === 'string') {
                skipped++;
                continue;
            }

            const idStr = val.toString();
            const slug = lookupMap[idStr];
            
            if (slug) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { [field]: slug } }
                );
                updated++;
            } else {
                // Referenced object doesn't exist — set to null
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { [field]: null } }
                );
                notFound++;
                console.log(`    ⚠ ${collectionName}[${doc._id}].${field}: ObjectId ${idStr} not found in lookup, set to null`);
            }
        }

        const key = `${collectionName}.${field}`;
        stats[key] = { total: docs.length, updated, skipped, notFound };
        console.log(`  ${key}: ${updated} updated, ${skipped} skipped, ${notFound} not found`);
    }

    // Project references
    await migrateField('offerings', 'project', projectMap);
    await migrateField('posts', 'project', projectMap);
    await migrateField('orders', 'project', projectMap);
    await migrateField('media', 'project', projectMap);
    await migrateField('users', 'project', projectMap);
    await migrateField('subscribers', 'project', projectMap);
    await migrateField('maillogs', 'project', projectMap);

    // Tree references
    await migrateField('offerings', 'tree', treeMap);

    // Media (image) references
    await migrateField('offerings', 'image', mediaMap);
    await migrateField('posts', 'image', mediaMap);
    await migrateField('pages', 'image', mediaMap);
    await migrateField('trees', 'image', mediaMap);

    // ──────────────────────────────────────────
    // Step 3: Denormalize Order.offering
    // ──────────────────────────────────────────
    console.log('\n═══ Step 3: Denormalizing Order.offering ═══');

    const offeringsLookup = {};
    for (const o of await db.collection('offerings').find({}).toArray()) {
        offeringsLookup[o._id.toString()] = {
            slug: o.slug,
            name: o.name,
            category: o.category || '',
            bezeichnungBotanisch: o.bezeichnungBotanisch || ''
        };
    }

    const orders = await db.collection('orders').find({
        offering: { $exists: true, $ne: null }
    }).toArray();

    let orderUpdated = 0;
    let orderSkipped = 0;
    for (const order of orders) {
        const val = order.offering;
        
        // Skip if already denormalized (is an object with slug)
        if (typeof val === 'object' && val !== null && val.slug) {
            orderSkipped++;
            continue;
        }

        const idStr = val.toString();
        const offeringData = offeringsLookup[idStr];

        if (offeringData) {
            await db.collection('orders').updateOne(
                { _id: order._id },
                { $set: { offering: offeringData } }
            );
            orderUpdated++;
        } else {
            await db.collection('orders').updateOne(
                { _id: order._id },
                { $set: { offering: { slug: idStr, name: 'Unbekannt' } } }
            );
            orderUpdated++;
            console.log(`    ⚠ Order[${order._id}].offering: ObjectId ${idStr} not found, stored as-is`);
        }
    }
    console.log(`  Orders: ${orderUpdated} denormalized, ${orderSkipped} skipped`);

    // ──────────────────────────────────────────
    // Step 4: Migrate media URLs in content fields
    // ──────────────────────────────────────────
    console.log('\n═══ Step 4: Migrating media URLs in content ═══');

    async function migrateContentUrls(collectionName) {
        const collection = db.collection(collectionName);
        const docs = await collection.find({
            content: { $exists: true, $ne: null, $regex: /\/api\/v1\/media\/[0-9a-fA-F]{24}\/file/ }
        }).toArray();

        let updated = 0;
        for (const doc of docs) {
            let content = doc.content;
            let changed = false;

            // Replace /api/v1/media/<objectid>/file with /api/v1/media/by-slug/<slug>/file
            content = content.replace(/\/api\/v1\/media\/([0-9a-fA-F]{24})\/file/g, (match, id) => {
                const slug = mediaIdToSlug[id];
                if (slug) {
                    changed = true;
                    return `/api/v1/media/by-slug/${slug}/file`;
                }
                console.log(`    ⚠ ${collectionName}[${doc._id}]: Media ObjectId ${id} not found in lookup`);
                return match; // Keep original if no slug found
            });

            if (changed) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { content } }
                );
                updated++;
            }
        }
        console.log(`  ${collectionName}: ${updated} documents updated`);
    }

    await migrateContentUrls('pages');
    await migrateContentUrls('posts');

    // ──────────────────────────────────────────
    // Step 5: Migrate deprecated user.profile → user.profiles
    // ──────────────────────────────────────────
    console.log('\n═══ Step 5: Migrating user.profile → user.profiles ═══');

    const usersWithProfile = await db.collection('users').find({
        profile: { $exists: true, $ne: null }
    }).toArray();

    let profileMigrated = 0;
    for (const user of usersWithProfile) {
        const profileId = user.profile;
        const existingProfiles = user.profiles || [];
        
        // Add to profiles array if not already present
        const alreadyHas = existingProfiles.some(p => p.toString() === profileId.toString());
        if (!alreadyHas) {
            await db.collection('users').updateOne(
                { _id: user._id },
                { 
                    $addToSet: { profiles: profileId },
                    $unset: { profile: '' }
                }
            );
        } else {
            await db.collection('users').updateOne(
                { _id: user._id },
                { $unset: { profile: '' } }
            );
        }
        profileMigrated++;
    }
    console.log(`  ${profileMigrated} users migrated`);

    // ──────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('   MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log('\nField migration summary:');
    for (const [key, val] of Object.entries(stats)) {
        console.log(`  ${key}: ${val.updated} updated, ${val.skipped} already done, ${val.notFound} not found`);
    }
    console.log(`\nOrder denormalization: ${orderUpdated} updated, ${orderSkipped} skipped`);
    console.log(`User profile migration: ${profileMigrated} migrated`);

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
