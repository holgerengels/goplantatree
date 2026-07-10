/**
 * Migration: Add slugs to existing PermissionProfiles.
 *
 * Usage:
 *   node scripts/migrate-profile-slugs.js
 *
 * Connects to the database, finds all PermissionProfiles without a slug,
 * and generates one from the name field using slugify().
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Inline slugify to avoid import path issues when running standalone
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

async function migrate() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set in .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to database.');

    const collection = mongoose.connection.collection('permissionprofiles');
    const profiles = await collection.find({ $or: [{ slug: null }, { slug: { $exists: false } }] }).toArray();

    if (profiles.length === 0) {
        console.log('All profiles already have slugs. Nothing to do.');
    } else {
        console.log(`Found ${profiles.length} profile(s) without slug.`);

        for (const profile of profiles) {
            const slug = slugify(profile.name);
            await collection.updateOne({ _id: profile._id }, { $set: { slug } });
            console.log(`  "${profile.name}" → slug: "${slug}"`);
        }

        console.log('Migration complete.');
    }

    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
