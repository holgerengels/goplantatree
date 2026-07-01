/**
 * Migration: Convert Offering.notice (String) → Offering.notices (Array of Strings)
 *
 * For each offering that has a non-empty `notice` field:
 *   - Wraps the string value into a single-element array `notices`
 *   - Removes the old `notice` field
 *
 * Usage: node scripts/migrate-offering-notice-to-notices.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const collection = mongoose.connection.collection('offerings');

    // 1. Convert notice → notices for documents that have a non-empty string value
    const cursor = collection.find({
        notice: { $exists: true, $ne: null, $ne: '' }
    });

    let converted = 0;
    for await (const doc of cursor) {
        const noticeValue = doc.notice;
        // Wrap single string into an array
        const notices = Array.isArray(noticeValue) ? noticeValue : [noticeValue];
        await collection.updateOne(
            { _id: doc._id },
            {
                $set: { notices },
                $unset: { notice: '' }
            }
        );
        converted++;
    }
    console.log(`✅ ${converted} offerings converted (notice → notices[])`);

    // 2. Remove empty/null notice fields from remaining documents
    const cleanupResult = await collection.updateMany(
        { notice: { $exists: true } },
        { $unset: { notice: '' } }
    );
    console.log(`🧹 ${cleanupResult.modifiedCount} offerings cleaned up (removed empty notice field)`);

    // Summary
    const total = await collection.countDocuments();
    const withNotices = await collection.countDocuments({ notices: { $exists: true, $ne: [] } });
    console.log(`\n📊 Total: ${total} offerings, ${withNotices} with notices`);

    await mongoose.disconnect();
    console.log('\n✅ Migration complete!');
    process.exit(0);
} catch (err) {
    console.error('❌ Migration error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
}
