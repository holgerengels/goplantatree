import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * GuestEdit — Generic magic-link token for confirming and editing guest-submitted
 * documents (e.g. 'posts', 'orders') without requiring user accounts.
 */
const guestEditSchema = new mongoose.Schema({
    token: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomBytes(32).toString('hex')
    },
    resource: { type: String, required: true, index: true },    // e.g. 'posts', 'orders'
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true },
    project: { type: String, default: null },
    allowedFields: [{ type: String }],                          // Whitelist of fields editable via this token
    confirmedAt: { type: Date, default: null },                 // null = unconfirmed, Date = first confirmation timestamp
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
}, {
    timestamps: true
});

export default mongoose.model('GuestEdit', guestEditSchema);
