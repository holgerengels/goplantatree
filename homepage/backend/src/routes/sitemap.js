import { Router } from 'express';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';
import { CONFIG_DIR } from '../utils/configLoader.js';
import Page from '../models/Page.js';

const router = Router();

/**
 * Loads all entity configs that have a public detail page (slug + detail config).
 * Returns an array of { slug, api, lookupField, publishedField, model }.
 */
const loadSitemapEntities = () => {
    const entities = [];
    try {
        const files = readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const config = JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf-8'));
            // Only include entities with a public detail page
            if (config.slug && config.detail?.slugField !== undefined || config.detail?.titleField) {
                // Derive mongoose model name from resource (e.g. 'posts' → 'Post', 'trees' → 'Tree')
                const resource = config.resource;
                if (!resource) continue;
                const modelName = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/s$/, '');
                try {
                    const model = mongoose.model(modelName);
                    entities.push({
                        urlPrefix: config.slug,
                        lookupField: config.detail?.slugField || 'slug',
                        publishedField: config.fields?.find(f => f.name === 'published') ? 'published' : null,
                        model
                    });
                } catch {
                    // Model not registered — skip silently
                }
            }
        }
    } catch (err) {
        console.error('[Sitemap] Error loading entity configs:', err.message);
    }
    return entities;
};

/**
 * GET /sitemap.xml — Dynamic XML sitemap
 *
 * Includes:
 * - Static pages (/, /seite/:slug)
 * - Projekt pages (/projekt/:slug)  
 * - All published entities with detail pages (posts, trees, etc.)
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urls = [];

        // 1. Homepage
        urls.push({ loc: baseUrl + '/', priority: '1.0', changefreq: 'weekly' });

        // 2. Published CMS pages → /seite/:slug (skip special slugs like home, 404, bestaetigen)
        const skipSlugs = new Set(['home', '404', 'bestaetigen']);
        const pages = await Page.find({ published: true }).select('slug updatedAt project').lean();

        for (const page of pages) {
            if (skipSlugs.has(page.slug)) continue;

            // Project pages use /projekt/:slug pattern
            if (page.slug.startsWith('projekt-')) {
                const projectSlug = page.slug.replace(/^projekt-/, '');
                urls.push({
                    loc: `${baseUrl}/projekt/${projectSlug}`,
                    lastmod: page.updatedAt?.toISOString(),
                    priority: '0.7',
                    changefreq: 'monthly'
                });
            } else {
                urls.push({
                    loc: `${baseUrl}/seite/${page.slug}`,
                    lastmod: page.updatedAt?.toISOString(),
                    priority: '0.6',
                    changefreq: 'monthly'
                });
            }
        }

        // 3. Published entities (posts, trees, and any future entities)
        const entities = loadSitemapEntities();
        for (const entity of entities) {
            const filter = entity.publishedField ? { [entity.publishedField]: true } : {};
            const items = await entity.model
                .find(filter)
                .select(`${entity.lookupField} updatedAt`)
                .lean();

            for (const item of items) {
                const slug = item[entity.lookupField];
                if (!slug) continue;
                urls.push({
                    loc: `${baseUrl}/${entity.urlPrefix}/${slug}`,
                    lastmod: item.updatedAt?.toISOString(),
                    priority: '0.5',
                    changefreq: 'monthly'
                });
            }
        }

        // Build XML
        const xmlUrls = urls.map(u => {
            let entry = `    <url>\n      <loc>${escapeXml(u.loc)}</loc>`;
            if (u.lastmod) entry += `\n      <lastmod>${u.lastmod}</lastmod>`;
            if (u.changefreq) entry += `\n      <changefreq>${u.changefreq}</changefreq>`;
            if (u.priority) entry += `\n      <priority>${u.priority}</priority>`;
            entry += '\n    </url>';
            return entry;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 hour
        res.send(xml);
    } catch (err) {
        console.error('[Sitemap] Error generating sitemap:', err);
        res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
});

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export default router;
