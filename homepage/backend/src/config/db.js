import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    const maxRetries = 10;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('MongoDB connected:', mongoose.connection.host);
            return;
        } catch (err) {
            console.error(`MongoDB connection error (attempt ${attempt}/${maxRetries}):`, err.message);
            if (attempt === maxRetries) {
                console.error('MongoDB connection failed after all retries. Exiting.');
                process.exit(1);
            }
            console.log(`Retrying in ${delay / 1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 2, 30000);
        }
    }
};

export default connectDB;
