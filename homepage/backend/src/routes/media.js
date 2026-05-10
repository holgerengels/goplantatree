import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { auth, requirePermission } from '../middleware/auth.js';
import Media from '../models/Media.js';
import sizeOf from 'image-size';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

const upload = multer({ 
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15 MB limit for MongoDB documents
});

const router = Router();

// GET /api/v1/media — Admin: List all media
router.get('/', auth, requirePermission('media', 'read'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;
        const search = req.query.search;
        
        const filter = {};
        if (req.permissionScope === 'own') {
            filter.project = req.user.project;
        }
        if (search) {
            filter.$or = [
                { title: new RegExp(search, 'i') },
                { originalName: new RegExp(search, 'i') }
            ];
        }

        const media = await Media.find(filter).select('-data').sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Media.countDocuments(filter);
        res.json({ items: media, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/media/:id — Admin: Get single media
router.get('/:id', auth, requirePermission('media', 'read'), async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') query.project = req.user.project;
        
        const media = await Media.findOne(query).select('-data');
        if (!media) return res.status(404).json({ error: 'Medium nicht gefunden' });
        res.json(media);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/media/:id/file — Public: Serve media file from MongoDB
router.get('/:id/file', async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media || !media.data) return res.status(404).send('Not found');
        
        res.set('Content-Type', media.mimeType);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(media.data);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// GET /api/v1/media/:id/info — Public: Get basic media metadata
router.get('/:id/info', async (req, res) => {
    try {
        const media = await Media.findById(req.params.id).select('filename title author authorLink license licenseLink url mimeType format width height');
        if (!media) return res.status(404).json({ error: 'Medium nicht gefunden' });
        res.json(media);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/media — Admin: Upload new media or external URL
router.post('/', auth, requirePermission('media', 'create'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file && !req.body.url) return res.status(400).json({ error: 'Keine Datei oder URL angegeben' });

        let width, height, format = 'unknown';
        if (req.file && req.file.mimetype.startsWith('image/')) {
            try {
                const dimensions = sizeOf(req.file.buffer);
                width = dimensions.width;
                height = dimensions.height;
                
                const ratio = width / height;
                const commonRatios = [
                    { name: '21:9', value: 21/9 },
                    { name: '16:9', value: 16/9 },
                    { name: '16:10', value: 16/10 },
                    { name: '3:2', value: 3/2 },
                    { name: '4:3', value: 4/3 },
                    { name: '5:4', value: 5/4 },
                    { name: '1:1', value: 1 },
                    { name: '4:5', value: 4/5 },
                    { name: '3:4', value: 3/4 },
                    { name: '2:3', value: 2/3 },
                    { name: '10:16', value: 10/16 },
                    { name: '9:16', value: 9/16 }
                ];
                
                format = 'unknown';
                for (const cr of commonRatios) {
                    if (Math.abs(ratio - cr.value) < 0.05) {
                        format = cr.name;
                        break;
                    }
                }
                if (format === 'unknown') {
                    if (width > height) format = 'landscape';
                    else if (width < height) format = 'portrait';
                    else format = 'square';
                }
            } catch (e) {
                console.error('Failed to get image dimensions:', e);
            }
        }

        const filename = req.file ? (Date.now() + '-' + Math.round(Math.random() * 1E9) + extname(req.file.originalname)) : 'external';

        const media = new Media({
            filename: req.file ? filename : 'external',
            originalName: req.file ? req.file.originalname : (req.body.title || 'external'),
            mimeType: req.file ? req.file.mimetype : 'external/url',
            size: req.file ? req.file.size : 0,
            url: req.body.url || '', // Will be updated if req.file exists
            data: req.file ? req.file.buffer : undefined,
            width,
            height,
            format,
            title: req.body.title || '',
            author: req.body.author || '',
            authorLink: req.body.authorLink || '',
            license: req.body.license || '',
            licenseLink: req.body.licenseLink || '',
            sourceLink: req.body.sourceLink || '',
            project: req.permissionScope === 'own' ? req.user.project : (req.body.project || null)
        });

        if (req.file) {
            media.url = `/api/v1/media/${media._id}/file`;
        }

        await media.save();
        
        // Remove buffer before returning JSON
        const responseData = media.toObject();
        delete responseData.data;
        
        res.status(201).json(responseData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/v1/media/:id — Admin: Update media metadata
router.put('/:id', auth, requirePermission('media', 'update'), async (req, res) => {
    try {
        // Prevent changing core file characteristics via PUT
        delete req.body.filename;
        delete req.body.mimeType;
        delete req.body.size;
        delete req.body.originalName;
        delete req.body.width;
        delete req.body.height;
        delete req.body.format;
        
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') {
            query.project = req.user.project;
            req.body.project = req.user.project;
        }

        const media = await Media.findOneAndUpdate(query, req.body, { new: true, runValidators: true }).select('-data');
        if (!media) return res.status(404).json({ error: 'Medium nicht gefunden' });
        res.json(media);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/v1/media/:id — Admin: Delete media
router.delete('/:id', auth, requirePermission('media', 'delete'), async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.permissionScope === 'own') query.project = req.user.project;
        
        const media = await Media.findOne(query);
        if (!media) return res.status(404).json({ error: 'Medium nicht gefunden' });
        
        // We don't remove files from disk anymore since they are in DB

        await Media.findByIdAndDelete(req.params.id);
        res.json({ message: 'Medium gelöscht' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
