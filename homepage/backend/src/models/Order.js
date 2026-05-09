import mongoose from 'mongoose';

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
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String }
}, {
    timestamps: true,
    strict: false
});

// Auto-generate order number before save
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments({ project: this.project });
        const year = new Date().getFullYear();
        this.orderNumber = `GPT-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

export default mongoose.model('Order', orderSchema);
