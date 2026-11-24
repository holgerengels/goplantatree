import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import MacroProjectSelector from '../MacroProjectSelector.vue';

let mockRoute;
let mockRouter;
let mockProjects;

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => mockRouter
}));

vi.mock('../../../stores/projects.js', () => ({
    useProjectsStore: () => ({
        projects: mockProjects,
        fetchProjects: vi.fn().mockResolvedValue(mockProjects)
    })
}));

describe('MacroProjectSelector.vue', () => {
    beforeEach(() => {
        mockRoute = reactive({ query: {} });
        mockRouter = {
            replace: vi.fn(({ query }) => {
                mockRoute.query = { ...query };
                return Promise.resolve();
            })
        };
        mockProjects = [
            { slug: 'ulm', name: 'Klimabaumaktion Ulm', active: true },
            { slug: 'augsburg', name: 'Baumpatenschaft Augsburg', active: true },
            { slug: 'archiv', name: 'Altes Projekt', active: false }
        ];
    });

    it('renders chips by default with "Alle Projekte" active when query is empty', () => {
        const wrapper = mount(MacroProjectSelector, {
            props: { allLabel: 'Alle Baumpatenschaften' }
        });

        const chips = wrapper.findAll('.chip-item');
        expect(chips.length).toBe(4); // 1 "Alle" + 3 projects
        expect(chips[0].text()).toBe('Alle Baumpatenschaften');
        expect(chips[0].classes()).toContain('active');
        expect(chips[1].classes()).not.toContain('active');
    });

    it('marks project chip as active if route.query.project matches', () => {
        mockRoute.query = { project: 'ulm' };
        const wrapper = mount(MacroProjectSelector);

        const chips = wrapper.findAll('.chip-item');
        expect(chips[0].classes()).not.toContain('active'); // "Alle" is inactive
        expect(chips[1].text()).toBe('Klimabaumaktion Ulm');
        expect(chips[1].classes()).toContain('active');
    });

    it('clicking a chip updates route query', async () => {
        const wrapper = mount(MacroProjectSelector);
        const chips = wrapper.findAll('.chip-item');

        await chips[1].trigger('click'); // Click "Ulm"
        expect(mockRouter.replace).toHaveBeenCalledWith({
            query: { project: 'ulm' }
        });
    });

    it('clicking an active chip toggles it off (clears project query)', async () => {
        mockRoute.query = { project: 'ulm' };
        const wrapper = mount(MacroProjectSelector);
        const chips = wrapper.findAll('.chip-item');

        await chips[1].trigger('click'); // Click already active "Ulm"
        expect(mockRouter.replace).toHaveBeenCalledWith({
            query: {}
        });
    });

    it('filters out inactive projects when activeOnly is true', () => {
        const wrapper = mount(MacroProjectSelector, {
            props: { activeOnly: true }
        });

        const chips = wrapper.findAll('.chip-item');
        expect(chips.length).toBe(3); // "Alle" + 2 active
        expect(wrapper.text()).not.toContain('Altes Projekt');
    });

    it('renders select dropdown when variant="select"', async () => {
        const wrapper = mount(MacroProjectSelector, {
            props: { variant: 'select', label: 'Projekt wählen:' }
        });

        expect(wrapper.find('select').exists()).toBe(true);
        expect(wrapper.find('.selector-label').text()).toBe('Projekt wählen:');
        const options = wrapper.findAll('option');
        expect(options.length).toBe(4);

        await wrapper.find('select').setValue('augsburg');
        expect(mockRouter.replace).toHaveBeenCalledWith({
            query: { project: 'augsburg' }
        });
    });
});
