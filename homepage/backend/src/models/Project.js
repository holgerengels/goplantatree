import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    orderPeriod: {
        start: Date,
        end: Date
    },
    active: { type: Boolean, default: true },
    orderFormConfig: { type: String },
    content: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true,
    strict: false
});

export default mongoose.model('Project', projectSchema);
