import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
