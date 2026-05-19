/**
 * One-time migration: Convert tree properties from comma-separated string to array.
 * 
 * Before: properties: "bienenfreundlich, hitzetolerant, trockenheitstolerant"
 * After:  properties: ["bienenfreundlich", "hitzetolerant", "trockenheitstolerant"]
 * 
 * Run: node --experimental-modules src/utils/migrate-tree-properties.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const trees = db.collection('trees');

    const docs = await trees.find({ properties: { $type: 'string' } }).toArray();
    console.log(`Found ${docs.length} trees with string properties to migrate`);

    let migrated = 0;
    for (const doc of docs) {
        if (!doc.properties || typeof doc.properties !== 'string') continue;

        const arr = doc.properties
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        await trees.updateOne(
            { _id: doc._id },
            { $set: { properties: arr } }
        );
        console.log(`  ✓ ${doc.name}: "${doc.properties}" → [${arr.join(', ')}]`);
        migrated++;
    }

    console.log(`\nMigration complete: ${migrated} trees updated.`);
    await mongoose.disconnect();
};

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
