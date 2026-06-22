import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

/**
 * Addon (Zusatzoption) — A reusable add-on option that can be assigned to offerings.
 * Scoped per project. Referenced by slug from offerings.
 */
const addonSchema = new mongoose.Schema({
    project: { type: String, required: true, index: true },       // Project slug
    name: { type: String, required: true },
    slug: { type: String, index: true },
    description: { type: String },
    sortOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Auto-derive slug from name if not set
addonSchema.pre('validate', function(next) {
    if (!this.slug && this.name) {
        this.slug = slugify(this.name);
    }
    next();
});

addonSchema.index({ project: 1, sortOrder: 1 });
addonSchema.index({ project: 1, slug: 1 }, { unique: true });

export default mongoose.model('Addon', addonSchema);
