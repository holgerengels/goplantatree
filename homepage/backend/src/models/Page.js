import mongoose from 'mongoose';

/**
 * Page (Seite) — Static content pages (Über uns, Impressum, etc.)
 */
const pageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    image: { type: String, default: null },                       // Media slug
    slug: { type: String, required: true, unique: true, index: true },
    heroSubtitle: { type: String },
    content: { type: String },
    published: { type: Boolean, default: true }
}, {
    timestamps: true,
    strict: false
});

export default mongoose.model('Page', pageSchema);
