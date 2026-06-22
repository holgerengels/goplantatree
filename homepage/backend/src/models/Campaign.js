import mongoose from 'mongoose';

/**
 * Campaign — Stores newsletter campaign metadata and progress.
 * Persists all template data so campaigns can be resumed after server restarts
 * without requiring the user to re-enter any form fields.
 */
const campaignSchema = new mongoose.Schema({
    campaignId: { type: String, required: true, unique: true, index: true },

    // Mail config
    account: { type: String, required: true },           // Mail account key (e.g. 'info')
    subjectTemplate: { type: String, required: true },   // Subject with {{placeholders}}
    htmlTemplate: { type: String, required: true },       // HTML body with {{placeholders}}
    textTemplate: { type: String, default: null },        // Optional plain text body

    // Filter used when creating the campaign
    project: { type: String, default: null },
    topic: { type: String, default: null },

    // Progress counters
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },

    // Status: starting → sending → completed | aborted | stopped | error
    status: {
        type: String,
        enum: ['starting', 'sending', 'rate-limited', 'completed', 'aborted', 'stopped', 'error'],
        default: 'starting'
    },

    // Recent errors (last 50)
    errors: [{
        email: String,
        error: String,
        _id: false
    }],

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null }
}, {
    timestamps: true
});

export default mongoose.model('Campaign', campaignSchema);
