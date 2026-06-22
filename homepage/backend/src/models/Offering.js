import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

/**
 * Offering (Angebot) — An orderable tree item within a specific project.
 * Each project has its own disjoint set of offerings.
 * An offering may optionally reference a Tree (Baumsteckbrief) for detail info.
 */
const offeringSchema = new mongoose.Schema({
    project: { type: String, required: true, index: true },       // Project slug
    tree: { type: String, default: null },                        // Tree slug
    name: { type: String, required: true },
    slug: { type: String, index: true },
    bezeichnungBotanisch: { type: String },
    image: { type: String, default: null },                       // Media slug
    category: { type: String },
    pflanzgroesseHoehe: { type: String },
    pflanzgroesseStammumfang: { type: String },
    endgroesseHoehe: { type: String },
    endgroesseBreite: { type: String },
    bemerkung: { type: String },
    available: { type: Boolean, default: true },
    stock: { type: Number, default: -1 },  // -1 = unlimited
    priceNet: { type: Number },
    notice: { type: String },
    addons: [{ type: String }],  // Array of Addon slugs
    sortOrder: { type: Number, default: 0 }
}, {
    timestamps: true,
    strict: false
});

// Auto-derive slug from name if not set
offeringSchema.pre('validate', function(next) {
    if (!this.slug && this.name) {
        this.slug = slugify(this.name);
    }
    next();
});

offeringSchema.index({ project: 1, sortOrder: 1 });
offeringSchema.index({ project: 1, slug: 1 }, { unique: true });

export default mongoose.model('Offering', offeringSchema);
