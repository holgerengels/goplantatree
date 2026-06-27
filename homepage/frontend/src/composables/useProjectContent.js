import { ref, watch } from 'vue';
import { api } from '../services/api.js';

/** Field names that hold media slug references */
const MEDIA_FIELDS = ['logo', 'avatar', 'image', 'media', 'photo', 'cover'];

/**
 * Resolve media slug strings within content items to full media objects.
 * After the switch to slug-based refs, fields like `logo` or `avatar` store
 * a plain slug string instead of an object with a `.url` property.
 * This fetches the media info for each slug and replaces the string in-place.
 */
async function resolveMediaSlugs(items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const resolved = items.map(item => ({ ...item }));

    const promises = [];
    for (const item of resolved) {
        for (const field of MEDIA_FIELDS) {
            if (typeof item[field] === 'string' && item[field]) {
                const slug = item[field];
                promises.push(
                    api.get(`/media/by-slug/${slug}/info`)
                        .then(media => { item[field] = media; })
                        .catch(() => { /* leave as string if resolution fails */ })
                );
            }
        }
    }

    await Promise.all(promises);
    return resolved;
}

/**
 * Composable to load a specific field from a project's content.
 * Reduces code duplication across MacroTeam, MacroSponsors, MacroTimeline.
 *
 * @param {Function} slugGetter - Reactive getter returning the project slug
 * @param {String} field - Content field to extract (e.g. 'team', 'sponsors', 'timeline')
 * @returns {import('vue').Ref<Array>} Reactive ref with the content data
 */
export function useProjectContent(slugGetter, field) {
    const data = ref([]);

    watch(slugGetter, async (slug) => {
        if (!slug) { data.value = []; return; }
        try {
            const project = await api.get(`/projects/${slug}`);
            const items = project?.content?.[field] || [];
            data.value = await resolveMediaSlugs(items);
        } catch {
            data.value = [];
        }
    }, { immediate: true });

    return data;
}
