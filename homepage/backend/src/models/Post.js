import mongoose from 'mongoose';

/**
 * Post (Beitrag) — Blog entries.
 * Renamed from the former Article model to avoid confusion with orderable items.
 */
const postSchema = new mongoose.Schema({
    project: { type: String, default: null, index: true },  // Project slug
    type: { type: String, enum: ['news', 'artikel', 'pflanzung'], default: 'news' },
    title: { type: String, required: true },
    slug: { type: String, required: true, index: true },
    content: { type: String },
    excerpt: { type: String },
    image: { type: String, default: null },                 // Media slug
    author: { type: String },
    publishedAt: { type: Date, default: Date.now },
    tags: [{ type: String }],
    published: { type: Boolean, default: false }
}, {
    timestamps: true,
    strict: false
});

postSchema.index({ project: 1, slug: 1 }, { unique: true });

export default mongoose.model('Post', postSchema);
