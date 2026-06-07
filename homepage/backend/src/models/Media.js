import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const mediaSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    data: { type: Buffer },
    
    // Image dimension properties
    width: { type: Number },
    height: { type: Number },
    format: { type: String, default: 'unknown' },
    
    // Extracted metadata
    title: { type: String },
    author: { type: String },
    authorLink: { type: String },
    license: { type: String },
    licenseLink: { type: String },
    sourceLink: { type: String },
    
    // Ownership
    project: { type: String, default: null }                      // Project slug
}, {
    timestamps: true
});

// Auto-derive slug from originalName (without file extension) if not set
mediaSchema.pre('validate', function(next) {
    if (!this.slug && this.originalName) {
        // Remove file extension before slugifying
        const nameWithoutExt = this.originalName.replace(/\.[^.]+$/, '');
        this.slug = slugify(nameWithoutExt);
    }
    next();
});

export default mongoose.model('Media', mediaSchema);
