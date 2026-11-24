import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * Composable for two-way synchronization of a reactive state with a URL query parameter.
 *
 * @param {string} paramName - Name of the query parameter in route.query (e.g. 'project')
 * @param {Object} [options] - Configuration options
 * @param {string} [options.defaultValue=''] - Default value when parameter is not present
 * @param {boolean} [options.replace=true] - Whether to use router.replace instead of router.push
 */
export function useQueryFilter(paramName = 'project', options = {}) {
    const route = useRoute();
    const router = useRouter();
    const defaultValue = options.defaultValue ?? '';
    const useReplace = options.replace !== false;

    const value = computed(() => {
        const raw = route?.query?.[paramName];
        if (raw === undefined || raw === null || raw === '') {
            return defaultValue;
        }
        return Array.isArray(raw) ? raw[0] : String(raw);
    });

    const setValue = async (newVal) => {
        if (!router || !route) return;
        const query = { ...route.query };
        const clean = newVal ? String(newVal).trim() : '';

        if (!clean || clean === defaultValue) {
            delete query[paramName];
        } else {
            query[paramName] = clean;
        }

        const navigate = useReplace ? router.replace : router.push;
        await navigate.call(router, { query });
    };

    const toggleValue = async (val) => {
        if (value.value === val) {
            await setValue('');
        } else {
            await setValue(val);
        }
    };

    const clear = async () => {
        await setValue('');
    };

    return {
        value,
        setValue,
        toggleValue,
        clear
    };
}
