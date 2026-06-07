import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

/**
 * Tree (Baumsteckbrief) — Educational tree profiles.
 * Project-independent. Shown on the Baumwissen page.
 * NOT orderable directly — Offerings reference Trees.
 */
const treeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    category: { type: String },
    height: { type: String },
    width: { type: String },
    sizeCategory: { type: String },
    flowering: { type: String },
    fruit: { type: String },
    location: { type: String },
    growthForm: { type: String },
    properties: [{ type: String }],
    description: { type: String },
    image: { type: String, default: null },                       // Media slug
    notice: { type: String }
}, {
    timestamps: true,
    strict: false
});

// Auto-derive slug from name if not set
treeSchema.pre('validate', function(next) {
    if (!this.slug && this.name) {
        this.slug = slugify(this.name);
    }
    next();
});

export default mongoose.model('Tree', treeSchema);
