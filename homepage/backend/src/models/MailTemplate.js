import mongoose from 'mongoose';

const mailTemplateSchema = new mongoose.Schema({
    slug: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['newsletter', 'transactional'] },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    project: { type: String, default: null },
    variables: [{ type: String }],
    active: { type: Boolean, default: true }
}, {
    timestamps: true
});

// Unique per slug + project combination
mailTemplateSchema.index({ slug: 1, project: 1 }, { unique: true });

export default mongoose.model('MailTemplate', mailTemplateSchema);
