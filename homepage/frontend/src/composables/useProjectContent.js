import { ref, watch } from 'vue';
import { api } from '../services/api.js';

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
            data.value = project?.content?.[field] || [];
        } catch {
            data.value = [];
        }
    }, { immediate: true });

    return data;
}
