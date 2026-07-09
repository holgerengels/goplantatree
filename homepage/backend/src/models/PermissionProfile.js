import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const permissionSchema = new mongoose.Schema({
    resource: { type: String, required: true },
    read: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    create: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    update: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    delete: { type: String, enum: ['none', 'own', 'all'], default: 'none' }
}, { _id: false });

const permissionProfileSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },
    description: { type: String },
    permissions: [permissionSchema]
}, {
    timestamps: true
});

// Auto-generate slug from name before save
permissionProfileSchema.pre('save', function (next) {
    if (this.isModified('name') || !this.slug) {
        this.slug = slugify(this.name);
    }
    next();
});

export default mongoose.model('PermissionProfile', permissionProfileSchema);
