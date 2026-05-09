import mongoose from 'mongoose';

/**
 * Tree (Baumsteckbrief) — Educational tree profiles.
 * Project-independent. Shown on the Baumwissen page.
 * NOT orderable directly — Offerings reference Trees.
 */
const treeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    shortName: { type: String, index: true },
    category: { type: String },
    height: { type: String },
    width: { type: String },
    sizeCategory: { type: String },
    flowering: { type: String },
    fruit: { type: String },
    location: { type: String },
    growthForm: { type: String },
    properties: { type: String },
    description: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    notice: { type: String },
    sortOrder: { type: Number, default: 0 }
}, {
    timestamps: true,
    strict: false
});

export default mongoose.model('Tree', treeSchema);
