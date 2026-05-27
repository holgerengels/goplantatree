import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'PermissionProfile', default: null },
    profiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PermissionProfile' }],
    displayName: { type: String }
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
        return ret;
    }
});

export default mongoose.model('User', userSchema);
