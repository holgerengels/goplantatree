import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = process.env.CONFIG_DIR || join(__dirname, '..', '..', '..', 'config');

/**
 * Load a JSON config file by name.
 * Returns the parsed config object, or null if the file does not exist.
 */
export function loadConfig(name) {
    try {
        const filePath = join(CONFIG_DIR, `${name}.json`);
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * Extract the allowed field names from a config's fields array.
 * Excludes display-only Content blocks (they carry no data).
 */
export function getConfigFieldNames(config) {
    if (!config?.fields) return null;
    return config.fields
        .filter(f => f.type !== 'Content')
        .map(f => f.name);
}

/** Prefix of template Pages for entity detail views: "detail-<entity-slug>" */
export const DETAIL_PAGE_PREFIX = 'detail-';

/**
 * All entity configs with a public detail view (`public` block).
 * Returns [{ urlPrefix, scopeField, seo, sitemap, publishedField, model }].
 * The Mongoose model is derived from `resource` ('trees' → 'Tree').
 */
export function loadPublicEntities() {
    const entities = [];
    let files = [];
    try {
        files = readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));
    } catch (err) {
        console.error('[configLoader] Cannot read config dir:', err.message);
        return entities;
    }
    for (const file of files) {
        try {
            const config = JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf-8'));
            if (!config.slug || !config.public || !config.resource) continue;
            const modelName = config.resource.charAt(0).toUpperCase() + config.resource.slice(1).replace(/s$/, '');
            let model;
            try { model = mongoose.model(modelName); } catch { continue; }
            entities.push({
                urlPrefix: config.slug,
                scopeField: config.public.scopeField || null,
                seo: config.public.seo || {},
                sitemap: config.public.sitemap !== false,
                publishedField: config.fields?.some(f => f.name === 'published') ? 'published' : null,
                model
            });
        } catch {
            // Skip malformed configs
        }
    }
    return entities;
}
