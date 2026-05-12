import mongoose from 'mongoose';

/**
 * Counter — Atomic sequence counters for generating unique IDs.
 * Used for order numbers, invoice numbers, etc.
 * Each counter is identified by a string key (e.g. "order-<projectId>-2026").
 */
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

export default mongoose.model('Counter', counterSchema);
