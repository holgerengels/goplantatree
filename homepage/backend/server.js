import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './src/config/db.js';
import { logger, errorHandler } from './src/middleware/logger.js';
import Media from './src/models/Media.js';

// Routes
import authRoutes from './src/routes/auth.js';
import projectRoutes from './src/routes/projects.js';
import treeRoutes from './src/routes/trees.js';
import offeringRoutes from './src/routes/offerings.js';
import addonRoutes from './src/routes/addons.js';
import postRoutes from './src/routes/posts.js';
import pageRoutes from './src/routes/pages.js';
import orderRoutes from './src/routes/orders.js';
import profileRoutes from './src/routes/profiles.js';
import userRoutes from './src/routes/users.js';
import subscriberRoutes from './src/routes/subscribers.js';
import configRoutes from './src/routes/config.js';
import mediaRoutes from './src/routes/media.js';
import mailRoutes from './src/routes/mail.js';
import mailTemplateRoutes from './src/routes/mailTemplates.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Trust first proxy (nginx in same container)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(logger);

// Rate limiting for public form submissions (disabled in test)
const isTest = process.env.NODE_ENV === 'test';
const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest
});
const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Zu viele Bestellungen. Bitte versuche es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest
});
app.post('/api/v1/subscribers', subscribeLimiter);
app.post('/api/v1/orders', orderLimiter);

// Serve uploaded files from MongoDB (with optional variant via ?v=thumb|small|medium)
app.get('/uploads/:filename', async (req, res, next) => {
    try {
        const variant = req.query.v;
        let fields = 'data mimeType';
        if (variant) fields += ` variants.${variant}`;

        const media = await Media.findOne({ filename: req.params.filename }).select(fields);
        if (!media) return res.status(404).send('File not found');

        // Serve variant if requested and available
        if (variant && media.variants?.get(variant)) {
            const v = media.variants.get(variant);
            res.set('Content-Type', v.mimeType);
            res.set('Cache-Control', 'public, max-age=31536000');
            return res.send(v.data);
        }

        if (!media.data) return res.status(404).send('File not found');
        res.set('Content-Type', media.mimeType);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(media.data);
    } catch (err) {
        next(err);
    }
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/trees', treeRoutes);
app.use('/api/v1/offerings', offeringRoutes);
app.use('/api/v1/addons', addonRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/pages', pageRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/subscribers', subscriberRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/mail', mailRoutes);
app.use('/api/v1/mail-templates', mailTemplateRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handling Middleware
app.use(errorHandler);

// Connect to DB and start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`GoPlantATree API running on port ${PORT}`);
        });
    });
}

export default app;
