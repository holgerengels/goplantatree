import { Router } from 'express';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG_DIR } from '../utils/configLoader.js';

const router = Router();

// In-memory cache for parsed JSON configurations
const configCache = new Map();
let entitiesCache = null;
let configListCache = null;

export const clearConfigCache = () => {
    configCache.clear();
    entitiesCache = null;
    configListCache = null;
};

// GET /api/v1/config — List all available config names
router.get('/', (req, res) => {
    try {
        if (configListCache) {
            return res.json(configListCache);
        }
        const files = readdirSync(CONFIG_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        configListCache = files;
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/config/entities — List all entity configs (with slug, label, icon, adminOnly)
// Used to dynamically build navigation menus
router.get('/entities', (req, res) => {
    try {
        if (entitiesCache) {
            return res.json(entitiesCache);
        }
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
                        configName: file.replace('.json', ''),
                        menuOrder: content.menuOrder !== undefined ? content.menuOrder : 999,
                        resource: content.resource || null
                    });
                }
            } catch {
                // Skip malformed configs
            }
        }

        // Sort entities by menuOrder
        entities.sort((a, b) => a.menuOrder - b.menuOrder);
        entitiesCache = entities;

        res.json(entities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/config/:name — Get specific config by name
router.get('/:name', (req, res) => {
    try {
        const name = req.params.name;
        if (configCache.has(name)) {
            return res.json(configCache.get(name));
        }
        const filePath = join(CONFIG_DIR, `${name}.json`);
        const content = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        configCache.set(name, parsed);
        res.json(parsed);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Konfiguration nicht gefunden' });
        }
        res.status(500).json({ error: err.message });
    }
});

export default router;
