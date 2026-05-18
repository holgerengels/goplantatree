// One-time migration: rename 'description' to 'text' in existing projects
// Run with: node backend/src/utils/migrate-project-text.js

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const migrate = async () => {
    await connectDB();
    
    const result = await mongoose.connection.db.collection('projects').updateMany(
        { description: { $exists: true } },
        [{ $set: { text: '$description' } }, { $unset: 'description' }]
    );
    
    console.log(`Migrated ${result.modifiedCount} projects: description → text`);
    await mongoose.disconnect();
};

migrate().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});
