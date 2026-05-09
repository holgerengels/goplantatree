import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
    resource: { type: String, required: true },
    read: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    create: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    update: { type: String, enum: ['none', 'own', 'all'], default: 'none' },
    delete: { type: String, enum: ['none', 'own', 'all'], default: 'none' }
}, { _id: false });

const permissionProfileSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    permissions: [permissionSchema]
}, {
    timestamps: true
});

export default mongoose.model('PermissionProfile', permissionProfileSchema);
