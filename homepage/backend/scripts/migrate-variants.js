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
import sizeOf from 'image-size';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

import Media from '../src/models/Media.js';
import { generateVariants, VARIANT_SIZES } from '../src/utils/imageVariants.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const ROTATED = process.argv.includes('--rotated') || process.argv.includes('--only-rotated');
const slugIdx = process.argv.indexOf('--slug');
const TARGET_SLUG = slugIdx !== -1 && process.argv[slugIdx + 1] ? process.argv[slugIdx + 1] : null;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';

async function migrate() {
    console.log(`🔄 Connecting to ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('   Connected.\n');

    if (DRY_RUN) console.log('   ⚠️  DRY RUN — no changes will be saved\n');
    if (FORCE) console.log('   ⚡ FORCE — regenerating all variants\n');
    if (ROTATED) console.log('   🔄 ROTATED ONLY — regenerating only images with EXIF orientation (5-8)\n');
    if (TARGET_SLUG) console.log(`   🎯 TARGET SLUG — only processing "${TARGET_SLUG}"\n`);

    // Find all image media that have binary data
    const query = {
        data: { $exists: true, $ne: null },
        mimeType: /^image\//
    };
    if (TARGET_SLUG) {
        query.slug = TARGET_SLUG;
    } else if (!FORCE && !ROTATED) {
        query['variants.thumb'] = { $exists: false };
    }

    const images = await Media.find(query).select('_id slug filename originalName mimeType width height data');

    console.log(`📦 Found ${images.length} images to inspect\n`);
    console.log(`   Variant sizes: ${Object.entries(VARIANT_SIZES).map(([k, v]) => `${k}=${v}px`).join(', ')}\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const media of images) {
        const label = media.slug || media.originalName || media.filename;
        try {
            let dimensions;
            try {
                dimensions = sizeOf(media.data);
            } catch {
                dimensions = {};
            }

            const isRotated = dimensions.orientation && [5, 6, 7, 8].includes(dimensions.orientation);

            if (ROTATED && !isRotated) {
                skipped++;
                continue;
            }

            const variants = await generateVariants(media.data);
            const variantNames = Object.keys(variants);

            if (variantNames.length === 0) {
                console.log(`   ⏩ ${label} — too small for variants (${media.width}px)`);
                skipped++;
                continue;
            }

            if (!DRY_RUN) {
                const update = { variants };
                let w = dimensions.width;
                let h = dimensions.height;
                if (isRotated) {
                    [w, h] = [h, w];
                }
                if (w && h) {
                    update.width = w;
                    update.height = h;
                    update.format = w > h ? 'landscape' : (w < h ? 'portrait' : 'square');
                }
                await Media.updateOne({ _id: media._id }, { $set: update });
            }

            const sizes = variantNames.map(n => `${n}: ${(variants[n].size / 1024).toFixed(0)}KB`).join(', ');
            console.log(`   ✅ ${label} ${isRotated ? '(rotated fix)' : ''} → ${sizes}`);
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
