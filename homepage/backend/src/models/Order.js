import mongoose from 'mongoose';
import Counter from './Counter.js';

const orderSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    offering: { type: mongoose.Schema.Types.ObjectId, ref: 'Offering' },
    orderNumber: { type: String, unique: true },
    status: {
        type: String,
        enum: ['neu', 'bestätigt', 'ausgegeben', 'storniert'],
        default: 'neu'
    },
    orderedAt: { type: Date, default: Date.now },
    name: { type: String, required: [true, 'Name ist ein Pflichtfeld'] },
    email: { type: String, required: [true, 'E-Mail ist ein Pflichtfeld'] },
    phone: { type: String },
    street: { type: String, required: [true, 'Straße ist ein Pflichtfeld'] },
    zip: { type: String, required: [true, 'PLZ ist ein Pflichtfeld'] },
    city: { type: String, required: [true, 'Stadt ist ein Pflichtfeld'] },
    quantity: { type: Number, required: [true, 'Anzahl ist ein Pflichtfeld'], default: 1 },
    agb: { type: Boolean, required: [true, 'AGB müssen akzeptiert werden'] },
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
