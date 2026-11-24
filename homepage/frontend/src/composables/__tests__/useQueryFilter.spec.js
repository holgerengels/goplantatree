import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { useQueryFilter } from '../useQueryFilter.js';

let mockRoute;
let mockRouter;

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => mockRouter
}));

describe('useQueryFilter', () => {
    beforeEach(() => {
        mockRoute = reactive({ query: {} });
        mockRouter = {
            replace: vi.fn(({ query }) => {
                mockRoute.query = { ...query };
                return Promise.resolve();
            }),
            push: vi.fn(({ query }) => {
                mockRoute.query = { ...query };
                return Promise.resolve();
            })
        };
    });

    it('reads initial value from route.query', () => {
        mockRoute.query = { project: 'klimabaum-ulm' };
        const { value } = useQueryFilter('project');
        expect(value.value).toBe('klimabaum-ulm');
    });

    it('returns empty string as default when param is missing', () => {
        const { value } = useQueryFilter('project');
        expect(value.value).toBe('');
    });

    it('sets query parameter via router.replace by default', async () => {
        const { setValue } = useQueryFilter('project');
        await setValue('mein-projekt');
        expect(mockRouter.replace).toHaveBeenCalledWith({
            query: { project: 'mein-projekt' }
        });
        expect(mockRoute.query.project).toBe('mein-projekt');
    });

    it('removes query parameter when set to empty string', async () => {
        mockRoute.query = { project: 'mein-projekt', other: '123' };
        const { setValue } = useQueryFilter('project');
        await setValue('');
        expect(mockRouter.replace).toHaveBeenCalledWith({
            query: { other: '123' }
        });
        expect(mockRoute.query.project).toBeUndefined();
    });

    it('toggleValue toggles on and off', async () => {
        const { value, toggleValue } = useQueryFilter('project');
        await toggleValue('mein-projekt');
        expect(value.value).toBe('mein-projekt');

        await toggleValue('mein-projekt');
        expect(value.value).toBe('');
    });
});
