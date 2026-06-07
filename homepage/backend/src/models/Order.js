import mongoose from 'mongoose';
import Counter from './Counter.js';

const orderSchema = new mongoose.Schema({
    project: { type: String, required: true, index: true },       // Project slug
    // Denormalisierte Offering-Daten (Snapshot zum Bestellzeitpunkt)
    offering: {
        slug: { type: String },
        name: { type: String },
        category: { type: String },
        bezeichnungBotanisch: { type: String },
        priceNet: { type: Number }
    },
    orderNumber: { type: String, unique: true },
    status: {
        type: String,
        enum: ['neu', 'bestätigt', 'ausgegeben', 'storniert'],
        default: 'neu'
    },
    orderedAt: { type: Date, default: Date.now },
    name: { type: String, required: [true, 'Name ist ein Pflichtfeld'] },
    email: { 
        type: String, 
        required: [true, 'E-Mail ist ein Pflichtfeld'],
        match: [/^\S+@\S+\.\S+$/, 'Bitte gib eine gültige E-Mail-Adresse ein.']
    },
    phone: { type: String },
    street: { type: String, required: [true, 'Straße ist ein Pflichtfeld'] },
    zip: { type: String, required: [true, 'PLZ ist ein Pflichtfeld'] },
    city: { type: String, required: [true, 'Stadt ist ein Pflichtfeld'] },
    specialAddress: { type: Boolean, default: false },
    quantity: { type: Number, required: [true, 'Anzahl ist ein Pflichtfeld'], default: 1 },
    agb: { type: Boolean, required: [true, 'AGB müssen akzeptiert werden'] },
    selectedAddons: [{ type: String }],
    address: { type: String }
}, {
    timestamps: true,
    strict: false
});

// Auto-generate order number using atomic counter before save
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const year = new Date().getFullYear();
        const counter = await Counter.findOneAndUpdate(
            { _id: `order-${this.project}-${year}` },
            { $inc: { seq: 1 } },
            { upsert: true, new: true }
        );
        this.orderNumber = `GPT-${year}-${String(counter.seq).padStart(4, '0')}`;
    }
    next();
});

export default mongoose.model('Order', orderSchema);
