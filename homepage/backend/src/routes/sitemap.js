import { Router } from 'express';
import { loadPublicEntities, DETAIL_PAGE_PREFIX } from '../utils/configLoader.js';
import Page from '../models/Page.js';

const router = Router();

/**
 * GET /sitemap.xml — Dynamic XML sitemap
 *
 * Includes:
 * - Static pages (/, /seite/:slug)
 * - Projekt pages (/projekt/:slug)  
 * - All published entities with a public detail view (config.public)
 *   whose template page "detail-<entity>" is published
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
            // Detail templates are not pages of their own
            if (page.slug.startsWith(DETAIL_PAGE_PREFIX)) continue;

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

        // 3. Published entities with public detail view (posts, trees, …)
        const publishedSlugs = new Set(pages.map(p => p.slug));
        const entities = loadPublicEntities().filter(e =>
            e.sitemap && publishedSlugs.has(`${DETAIL_PAGE_PREFIX}${e.urlPrefix}`));
        for (const entity of entities) {
            const filter = entity.publishedField ? { [entity.publishedField]: true } : {};
            const items = await entity.model
                .find(filter)
                .select(`slug ${entity.scopeField || ''} updatedAt`)
                .lean();

            for (const item of items) {
                const slug = item.slug;
                if (!slug) continue;
                // Scoped entities (slug only unique per parent): /prefix/scope/slug
                let path = slug;
                if (entity.scopeField) {
                    const scope = item[entity.scopeField];
                    if (!scope) continue;
                    path = `${scope}/${slug}`;
                }
                urls.push({
                    loc: `${baseUrl}/${entity.urlPrefix}/${path}`,
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
