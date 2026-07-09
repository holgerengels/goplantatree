import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    project: { type: String, default: null },                     // Project slug
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    profiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PermissionProfile' }],
    displayName: { type: String },
    apiKey: { type: String, unique: true, sparse: true }
}, {
    timestamps: true
});

// Hash password before save
userSchema.pre('save', async function (next) {
    if (this.isModified('passwordHash')) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHash);
};

// Never return password hash in JSON
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.apiKey;
        return ret;
    }
});

export default mongoose.model('User', userSchema);
