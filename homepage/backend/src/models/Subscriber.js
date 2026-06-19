import mongoose from 'mongoose';
import crypto from 'crypto';

const subscriberSchema = new mongoose.Schema({
    project: { type: String, default: null, index: true },        // Project slug
    email: { type: String, required: true },
    name: { type: String },
    topics: { type: [String], default: ['general'] },
    subscribedAt: { type: Date, default: Date.now },
    status: {
        type: [String],
        default: [],
        index: true
    },
    confirmToken: { type: String },
    tags: [{ type: String }],
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true,
    strict: false
});

// Unique email per project
subscriberSchema.index({ project: 1, email: 1 }, { unique: true });

// Generate confirm token before save
subscriberSchema.pre('save', function (next) {
    if (!this.confirmToken) {
        this.confirmToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

/**
 * Helper: check if subscriber has a specific status.
 */
subscriberSchema.methods.hasStatus = function (s) {
    return this.status.includes(s);
};

/**
 * Helper: add a status if not already present.
 */
subscriberSchema.methods.addStatus = function (s) {
    if (!this.status.includes(s)) {
        this.status.push(s);
    }
};

/**
 * Helper: remove a status.
 */
subscriberSchema.methods.removeStatus = function (s) {
    this.status = this.status.filter(v => v !== s);
};

export default mongoose.model('Subscriber', subscriberSchema);
