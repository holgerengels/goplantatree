/**
 * Migration: Rename Tree.notice → Tree.summary
 *
 * Usage: node scripts/migrate-tree-notice-to-summary.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const collection = mongoose.connection.collection('trees');

    // Rename notice → summary for all documents that have the old field
    const result = await collection.updateMany(
        { notice: { $exists: true } },
        { $rename: { notice: 'summary' } }
    );
    console.log(`✅ ${result.modifiedCount} trees migrated (notice → summary)`);

    // Summary
    const total = await collection.countDocuments();
    const withSummary = await collection.countDocuments({ summary: { $exists: true } });
    console.log(`\n📊 Total: ${total} trees, ${withSummary} with summary field`);

    await mongoose.disconnect();
    console.log('\n✅ Migration complete!');
    process.exit(0);
} catch (err) {
    console.error('❌ Migration error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
}
