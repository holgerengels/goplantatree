import mongoose from 'mongoose';

/**
 * Offering (Angebot) — An orderable tree item within a specific project.
 * Each project has its own disjoint set of offerings.
 * An offering may optionally reference a Tree (Baumsteckbrief) for detail info.
 */
const offeringSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    tree: { type: mongoose.Schema.Types.ObjectId, ref: 'Tree', default: null },
    name: { type: String, required: true },
    bezeichnungBotanisch: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    category: { type: String },
    pflanzgroesseHoehe: { type: String },
    pflanzgroesseStammumfang: { type: String },
    endgroesseHoehe: { type: String },
    endgroesseBreite: { type: String },
    bemerkung: { type: String },
    available: { type: Boolean, default: true },
    stock: { type: Number, default: -1 },  // -1 = unlimited
    notice: { type: String },
    addons: [{
        name: { type: String, required: true },
        description: { type: String }
    }],
    sortOrder: { type: Number, default: 0 }
}, {
    timestamps: true,
    strict: false
});

offeringSchema.index({ project: 1, sortOrder: 1 });

export default mongoose.model('Offering', offeringSchema);
