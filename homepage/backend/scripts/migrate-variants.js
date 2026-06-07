#!/usr/bin/env node
/**
 * Migration script: Generate image variants for all existing media documents.
 *
 * Usage:
 *   node scripts/migrate-variants.js              # Process all images
 *   node scripts/migrate-variants.js --dry-run    # Preview only
 *
 * On server:
 *   docker exec goplantatree-app node scripts/migrate-variants.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

import Media from '../src/models/Media.js';
import { generateVariants, VARIANT_SIZES } from '../src/utils/imageVariants.js';

const DRY_RUN = process.argv.includes('--dry-run');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';

async function migrate() {
    console.log(`🔄 Connecting to ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('   Connected.\n');

    if (DRY_RUN) console.log('   ⚠️  DRY RUN — no changes will be saved\n');

    // Find all image media that have binary data but no variants yet
    const images = await Media.find({
        data: { $exists: true, $ne: null },
        mimeType: /^image\//,
        'variants.thumb': { $exists: false }
    }).select('_id filename originalName mimeType width data');

    console.log(`📦 Found ${images.length} images to process\n`);
    console.log(`   Variant sizes: ${Object.entries(VARIANT_SIZES).map(([k, v]) => `${k}=${v}px`).join(', ')}\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const media of images) {
        const label = media.originalName || media.filename;
        try {
            const variants = await generateVariants(media.data);
            const variantNames = Object.keys(variants);

            if (variantNames.length === 0) {
                console.log(`   ⏩ ${label} — too small for variants (${media.width}px)`);
                skipped++;
                continue;
            }

            if (!DRY_RUN) {
                await Media.updateOne({ _id: media._id }, { $set: { variants } });
            }

            const sizes = variantNames.map(n => `${n}: ${(variants[n].size / 1024).toFixed(0)}KB`).join(', ');
            console.log(`   ✅ ${label} → ${sizes}`);
            processed++;
        } catch (err) {
            console.error(`   ❌ ${label} — ${err.message}`);
            errors++;
        }
    }

    console.log(`\n📊 Done: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
