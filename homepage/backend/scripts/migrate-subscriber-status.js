/**
 * Migration: Convert Subscriber.confirmed (Boolean) → status ([String])
 *
 * Usage: node scripts/migrate-subscriber-status.js
 *
 * - confirmed: true  → status: ['confirmed']
 * - confirmed: false → status: []
 * - Removes the old `confirmed` field
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const collection = mongoose.connection.collection('subscribers');

    // 1. Migrate confirmed: true → status: ['confirmed']
    const confirmedResult = await collection.updateMany(
        { confirmed: true, status: { $exists: false } },
        { $set: { status: ['confirmed'] }, $unset: { confirmed: '' } }
    );
    console.log(`✅ ${confirmedResult.modifiedCount} confirmed subscribers migrated to status: ['confirmed']`);

    // 2. Migrate confirmed: false → status: []
    const unconfirmedResult = await collection.updateMany(
        { confirmed: false, status: { $exists: false } },
        { $set: { status: [] }, $unset: { confirmed: '' } }
    );
    console.log(`✅ ${unconfirmedResult.modifiedCount} unconfirmed subscribers migrated to status: []`);

    // 3. Clean up any remaining with confirmed field but already has status
    const cleanupResult = await collection.updateMany(
        { confirmed: { $exists: true }, status: { $exists: true } },
        { $unset: { confirmed: '' } }
    );
    console.log(`🧹 ${cleanupResult.modifiedCount} subscribers cleaned up (removed old confirmed field)`);

    // 4. Ensure empty data object for those missing it
    const dataResult = await collection.updateMany(
        { data: { $exists: false } },
        { $set: { data: {} } }
    );
    console.log(`📋 ${dataResult.modifiedCount} subscribers got empty data object`);

    // Summary
    const total = await collection.countDocuments();
    const withStatus = await collection.countDocuments({ status: { $exists: true } });
    console.log(`\n📊 Total: ${total} subscribers, ${withStatus} with status field`);

    await mongoose.disconnect();
    console.log('\n✅ Migration complete!');
    process.exit(0);
} catch (err) {
    console.error('❌ Migration error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
}
