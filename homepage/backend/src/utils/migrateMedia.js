import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import sizeOf from 'image-size';
import Media from '../models/Media.js';

// Setup environment and DB connection
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree';
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

async function migrateMedia() {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB.');

    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('Uploads directory does not exist. Nothing to migrate.');
        process.exit(0);
    }

    const files = fs.readdirSync(UPLOADS_DIR);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        if (!fs.lstatSync(filePath).isFile()) continue;

        try {
            const fileBuffer = fs.readFileSync(filePath);
            const size = fileBuffer.length;
            
            if (size === 0) {
                console.warn(`Skipping empty file: ${file}`);
                continue;
            }

            let width, height, format = 'unknown';
            let mimeType = 'application/octet-stream';

            const ext = path.extname(file).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.gif') mimeType = 'image/gif';
            else if (ext === '.svg') mimeType = 'image/svg+xml';
            else if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.pdf') mimeType = 'application/pdf';
            else if (ext === '.mp4') mimeType = 'video/mp4';

            if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
                try {
                    const dimensions = sizeOf(filePath);
                    width = dimensions.width;
                    height = dimensions.height;
                    
                    const ratio = width / height;
                    if (width > height) format = 'landscape';
                    else if (width < height) format = 'portrait';
                    else format = 'square';
                } catch (e) {
                    console.warn(`Could not get dimensions for ${file}`);
                }
            }

            let mediaDoc = await Media.findOne({ filename: file });

            if (mediaDoc) {
                // Update existing document with binary data
                mediaDoc.data = fileBuffer;
                mediaDoc.size = size;
                if (!mediaDoc.mimeType || mediaDoc.mimeType === 'external/url') {
                    mediaDoc.mimeType = mimeType;
                }
                if (width) mediaDoc.width = width;
                if (height) mediaDoc.height = height;
                if (format !== 'unknown') mediaDoc.format = format;
                
                await mediaDoc.save();
                console.log(`Updated existing document: ${file}`);
            } else {
                // Create new document
                mediaDoc = new Media({
                    filename: file,
                    originalName: file,
                    mimeType: mimeType,
                    size: size,
                    url: `/uploads/${file}`,
                    data: fileBuffer,
                    width,
                    height,
                    format,
                    title: file
                });
                await mediaDoc.save();
                console.log(`Created new document: ${file}`);
            }
            
            successCount++;
        } catch (err) {
            console.error(`Failed to migrate ${file}:`, err.message);
            errorCount++;
        }
    }

    console.log('\nMigration complete.');
    console.log(`Successfully migrated: ${successCount} files.`);
    console.log(`Failed: ${errorCount} files.`);

    process.exit(0);
}

migrateMedia().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
