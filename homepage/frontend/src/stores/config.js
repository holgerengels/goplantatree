import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../services/api.js';

/**
 * Central store for entity configurations.
 * Loads and caches JSON entity configs from the backend.
 * Used by all generic pages and the admin sidebar.
 */
export const useConfigStore = defineStore('config', () => {
    const entities = ref([]);
    const configCache = ref({});
    const loaded = ref(false);

    const menu = ref(null);
    const menuLoaded = ref(false);

    /**
     * Load the list of all entity configs (for navigation).
     */
    const fetchEntities = async () => {
        if (loaded.value) return;
        try {
            entities.value = await api.get('/config/entities');
            loaded.value = true;
        } catch (err) {
            console.error('Failed to load entity configs:', err);
        }
    };

    /**
     * Load a specific entity config by its config name (e.g. "tree", "article").
     * Results are cached.
     */
    const fetchConfig = async (name) => {
        if (configCache.value[name]) return configCache.value[name];
        try {
            const config = await api.get(`/config/${name}`);
            configCache.value[name] = config;
            return config;
        } catch (err) {
            throw new Error(`Config "${name}" nicht gefunden`);
        }
    };

    /**
     * Find a config by its slug (e.g. "baeume" → tree.json).
     */
    const findBySlug = (slug) => {
        return entities.value.find(e => e.slug === slug);
    };

    /**
     * Load menu configuration from menu.json.
     */
    const fetchMenu = async () => {
        if (menuLoaded.value) return;
        try {
            menu.value = await api.get('/config/menu');
            menuLoaded.value = true;
        } catch (err) {
            console.error('Failed to load menu config:', err);
        }
    };

    /**
     * Header menu entries from menu.json.
     */
    const headerMenu = computed(() => menu.value?.header || []);

    /**
     * Footer menu sections from menu.json.
     */
    const footerMenu = computed(() => menu.value?.footer || {});

    /**
     * Entities that have public list pages.
     */
    const publicEntities = computed(() =>
        entities.value.filter(e => e.hasPublicList && !e.adminOnly)
    );

    /**
     * All entities for admin sidebar.
     */
    const adminEntities = computed(() => entities.value);

    return {
        entities, configCache, loaded,
        menu, menuLoaded,
        fetchEntities, fetchConfig, findBySlug, fetchMenu,
        headerMenu, footerMenu,
        publicEntities, adminEntities
    };
});
