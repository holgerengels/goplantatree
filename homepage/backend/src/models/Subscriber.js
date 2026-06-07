import mongoose from 'mongoose';
import crypto from 'crypto';

const subscriberSchema = new mongoose.Schema({
    project: { type: String, default: null, index: true },        // Project slug
    email: { type: String, required: true },
    name: { type: String },
    topic: { type: String, default: 'general' },
    subscribedAt: { type: Date, default: Date.now },
    confirmed: { type: Boolean, default: false },
    confirmToken: { type: String },
    tags: [{ type: String }]
}, {
    timestamps: true,
    strict: false
});

// Unique email per project+topic
subscriberSchema.index({ project: 1, email: 1, topic: 1 }, { unique: true });

// Generate confirm token before save
subscriberSchema.pre('save', function (next) {
    if (!this.confirmToken) {
        this.confirmToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

export default mongoose.model('Subscriber', subscriberSchema);
