import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Tree from '../models/Tree.js';
import Project from '../models/Project.js';
import Page from '../models/Page.js';
import Post from '../models/Post.js';
import Media from '../models/Media.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine the path to index.html based on environment
let indexPath = '';
if (process.env.NODE_ENV === 'production' && process.platform === 'linux') {
    // Assuming standard Docker deployment with Nginx
    indexPath = '/usr/share/nginx/html/index.html';
} else {
    // Local dev: point to frontend/dist/index.html
    indexPath = path.join(__dirname, '../../../../frontend/dist/index.html');
}

const SITE_NAME = 'Go Plant A Tree';
const DEFAULT_DESC = 'Es gibt noch so viel Platz für Bäume. Es muss sie nur jemand pflanzen!';

// Helper to resolve media URL
const getMediaUrl = async (imageSlug) => {
    if (!imageSlug) return null;
    if (imageSlug.startsWith('http')) return imageSlug;
    return `/api/v1/media/by-slug/${imageSlug}/file`;
};

router.get('*', async (req, res, next) => {
    try {
        // Only process GET requests that accept HTML
        if (req.method !== 'GET' || !req.accepts('html')) {
            return next();
        }

        // Try to read index.html
        let html;
        try {
            html = await fs.readFile(indexPath, 'utf-8');
        } catch (err) {
            // Fallback if index.html is missing (e.g., local dev before build)
            return res.send(`<!DOCTYPE html><html><head><title>${SITE_NAME}</title></head><body><h1>Frontend not built yet. Please run npm run build in frontend.</h1></body></html>`);
        }

        const requestUrl = req.path;
        let title = SITE_NAME;
        let description = DEFAULT_DESC;
        let image = null;

        // Route matching logic
        const parts = requestUrl.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const entityType = parts[0];
            const slug = parts[1];

            if (entityType === 'baeume') {
                const tree = await Tree.findOne({ slug });
                if (tree) {
                    title = `${tree.name} — ${SITE_NAME}`;
                    description = tree.summary || description;
                    image = tree.image;
                }
            } else if (entityType === 'projekt' || entityType === 'bestellen') {
                const project = await Project.findOne({ slug });
                if (project) {
                    title = `${project.name} — ${SITE_NAME}`;
                    description = project.shortDescription || description;
                    image = project.image;
                }
            } else if (entityType === 'seite') {
                const page = await Page.findOne({ slug });
                if (page) {
                    title = `${page.title} — ${SITE_NAME}`;
                    description = page.description || description;
                    image = page.image;
                }
            } else if (entityType === 'beitraege') {
                const post = await Post.findOne({ slug });
                if (post) {
                    title = `${post.title} — ${SITE_NAME}`;
                    description = post.excerpt || description;
                    image = post.image;
                }
            }
        } else if (parts.length === 1 && parts[0] === 'login') {
             title = `Login — ${SITE_NAME}`;
        }

        // Resolve absolute image URL for OG tags
        let absoluteImage = null;
        if (image) {
            const mediaUrl = await getMediaUrl(image);
            if (mediaUrl) {
                // Determine base URL, considering potential proxies
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.headers['host'];
                const baseUrl = `${protocol}://${host}`;
                absoluteImage = mediaUrl.startsWith('http') ? mediaUrl : `${baseUrl}${mediaUrl}`;
            }
        }

        // Generate meta tags
        // Determine base URL for OG URL
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['host'];
        const fullUrl = `${protocol}://${host}${req.originalUrl}`;
        
        const metaTags = `
            ${absoluteImage ? `<link rel="preload" as="image" href="${absoluteImage}" />` : ''}
            <meta name="description" content="${description}" />
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="${fullUrl}" />
            <meta property="og:site_name" content="${SITE_NAME}" />
            ${absoluteImage ? `<meta property="og:image" content="${absoluteImage}" />` : ''}
            <meta name="twitter:card" content="${absoluteImage ? 'summary_large_image' : 'summary'}" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${description}" />
            ${absoluteImage ? `<meta name="twitter:image" content="${absoluteImage}" />` : ''}
            <title>${title}</title>
        `;

        // Inject into <head>
        html = html.replace(/<title>.*<\/title>/i, '');
        html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
        html = html.replace('</head>', `${metaTags}</head>`);

        res.send(html);
    } catch (err) {
        console.error('Error serving dynamic index.html:', err);
        next(err);
    }
});

export default router;
