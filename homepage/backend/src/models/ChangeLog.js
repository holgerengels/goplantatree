import mongoose from 'mongoose';

/**
 * ChangeLog — Audit log for all CRUD mutations.
 * Stores before/after snapshots (undo-capable) plus a computed diff for readability.
 * Entries are created by the crudFactory and are always readonly via the API.
 */
const changeLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    user: { type: String, default: 'system', index: true },         // username or 'public'/'system'
    resource: { type: String, required: true, index: true },         // e.g. 'orders', 'trees'
    action: { type: String, required: true, enum: ['create', 'update', 'delete'] },
    documentId: { type: String, required: true, index: true },       // _id of affected document
    documentSlug: { type: String, default: null },                   // slug for readability (if available)
    before: { type: mongoose.Schema.Types.Mixed, default: null },    // snapshot before change (null on create)
    after: { type: mongoose.Schema.Types.Mixed, default: null },     // snapshot after change (null on delete)
    diff: { type: mongoose.Schema.Types.Mixed, default: null },      // { field: { from, to } } (only on update)
    metadata: { type: mongoose.Schema.Types.Mixed, default: null }   // operational context (source, cascade, ip)
});

// Compound index for common query: "history of a specific document"
changeLogSchema.index({ resource: 1, documentId: 1, timestamp: -1 });

export default mongoose.model('ChangeLog', changeLogSchema);
