import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';

dotenv.config();

async function run() {
    try {
        const uri = process.env.MONGODB_URI || "mongodb://admin:password@localhost:27017/goplantatree?authSource=admin";
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const username = process.argv[2];
        const rawPassword = process.argv[3];

        if (!username || !rawPassword) {
            console.error('Fehler: Bitte Benutzername und Passwort als Argumente übergeben.');
            console.error('Verwendung: node update-pass.js <username> <password>');
            process.exit(1);
        }

        // Hash the password using bcryptjs
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        // Find user by username
        let user = await User.findOne({ username });
        if (!user) {
            console.log(`User ${username} not found in DB. Creating new user...`);
            user = new User({
                username,
                email: 'holger@example.com',
                passwordHash
            });
        } else {
            console.log(`User ${username} found. Updating password...`);
            user.passwordHash = passwordHash;
        }

        await user.save();
        console.log(`Successfully set password for '${username}' to '${rawPassword}' (hashed: ${passwordHash})`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
