import { Router } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', '..', '..', 'config');

const router = Router();

// GET /api/v1/config — List all available config names
router.get('/', (req, res) => {
    try {
        const files = readdirSync(CONFIG_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/config/entities — List all entity configs (with slug, label, icon, adminOnly)
// Used to dynamically build navigation menus
router.get('/entities', (req, res) => {
    try {
        const files = readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));
        const entities = [];

        for (const file of files) {
            try {
                const content = JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf-8'));
                // Only include configs that have an entity + slug (not project-specific configs like klimabaumaktion-order)
                if (content.entity && content.slug) {
                    entities.push({
                        entity: content.entity,
                        slug: content.slug,
                        label: content.label,
                        icon: content.icon || '📄',
                        adminOnly: content.adminOnly || false,
                        hasPublicList: !!content.list,
                        hasPublicDetail: !!content.detail,
                        configName: file.replace('.json', ''),
                        menuOrder: content.menuOrder !== undefined ? content.menuOrder : 999
                    });
                }
            } catch {
                // Skip malformed configs
            }
        }

        // Sort entities by menuOrder
        entities.sort((a, b) => a.menuOrder - b.menuOrder);

        res.json(entities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/config/:name — Get specific config by name
router.get('/:name', (req, res) => {
    try {
        const filePath = join(CONFIG_DIR, `${req.params.name}.json`);
        const content = readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(content));
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Konfiguration nicht gefunden' });
        }
        res.status(500).json({ error: err.message });
    }
});

export default router;
