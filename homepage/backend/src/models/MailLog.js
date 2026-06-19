import mongoose from 'mongoose';

/**
 * MailLog — Tracks every email sent by the system.
 * Each send attempt creates one entry. Status transitions:
 *   queued → sent → bounced (if bounce detected)
 *   queued → failed (if SMTP error)
 */
const mailLogSchema = new mongoose.Schema({
    project: { type: String, default: null, index: true },        // Project slug
    to: { type: String, required: true, index: true },
    from: { type: String },
    subject: { type: String },
    template: { type: String },                              // e.g. 'order-confirmation', 'newsletter'
    referenceId: { type: mongoose.Schema.Types.ObjectId },   // Order-ID, Subscriber-ID, etc.
    referenceType: { type: String },                         // 'Order', 'Subscriber', etc.
    campaignId: { type: String, index: true },               // Groups mails into a newsletter campaign
    status: {
        type: String,
        enum: ['queued', 'sent', 'bounced', 'failed'],
        default: 'queued',
        index: true
    },
    sentAt: { type: Date },
    smtpResponse: { type: String },
    bounceInfo: {
        detectedAt: { type: Date },
        type: { type: String },           // 'hard', 'soft'
        diagnosticCode: { type: String }, // e.g. '550 5.1.1 User unknown'
        rawSubject: { type: String }      // Subject of the bounce message
    },
    error: { type: String }
}, {
    timestamps: true
});

// Fast lookup for bounce matching: find recent sends to a specific address
mailLogSchema.index({ to: 1, sentAt: -1 });

export default mongoose.model('MailLog', mailLogSchema);
