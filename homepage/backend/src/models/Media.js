import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    
    // Image dimension properties
    width: { type: Number },
    height: { type: Number },
    format: { type: String, default: 'unknown' },
    
    // Extracted metadata
    title: { type: String },
    author: { type: String },
    authorLink: { type: String },
    license: { type: String },
    licenseLink: { type: String },
    sourceLink: { type: String },
    
    // Ownership
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }
}, {
    timestamps: true
});

export default mongoose.model('Media', mediaSchema);
