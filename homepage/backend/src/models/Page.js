import mongoose from 'mongoose';

/**
 * Page (Seite) — Static content pages (Über uns, Impressum, etc.)
 * or dynamic templates (template: true, e.g. detail-blog, detail-baeume).
 */
const pageSchema = new mongoose.Schema({
    project: { type: String, default: null },                     // Project slug (soft ref)
    title: { type: String, required: true },
    image: { type: String, default: null },                       // Media slug
    slug: { type: String, required: true, unique: true, index: true },
    heroSubtitle: { type: String },
    heroContent: { type: String },
    content: { type: String },
    published: { type: Boolean, default: true },
    template: { type: Boolean, default: false }                   // If true: page is a template (not directly viewable via /seite/:slug)
}, {
    timestamps: true,
    strict: false
});

export default mongoose.model('Page', pageSchema);
