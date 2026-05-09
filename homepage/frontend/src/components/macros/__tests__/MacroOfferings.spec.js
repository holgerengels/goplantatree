import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MacroOfferings from '../MacroOfferings.vue';

// Mock the global fetch
global.fetch = vi.fn();

describe('MacroOfferings.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches offerings on mount and renders them', async () => {
        const mockOfferings = [
            { _id: '1', name: 'Tree 1', category: 'Laubbaum', tree: { notice: 'Notice 1' }, image: { url: 'img1.jpg' } },
            { _id: '2', name: 'Tree 2', category: 'Obstbaum', tree: {} }
        ];

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOfferings
        });

        // Use mount with a stubbed router-link
        const wrapper = mount(MacroOfferings, {
            props: { project: 'test-project' },
            global: {
                stubs: ['router-link']
            }
        });

        // Wait for the immediate watch and fetch to resolve
        await vi.dynamicImportSettled();
        await new Promise(r => setTimeout(r, 10)); // flush promises

        expect(global.fetch).toHaveBeenCalledWith('/api/v1/offerings?project=test-project&available=true');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const cards = wrapper.findAll('.offering-card');
        expect(cards.length).toBe(2);
        expect(wrapper.text()).toContain('Tree 1');
        expect(wrapper.text()).toContain('Tree 2');
    });

    it('refetches when project prop changes', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => []
        });

        const wrapper = mount(MacroOfferings, {
            props: { project: 'project-a' },
            global: {
                stubs: ['router-link']
            }
        });

        await new Promise(r => setTimeout(r, 10));
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/offerings?project=project-a&available=true');

        // Change prop
        await wrapper.setProps({ project: 'project-b' });
        await new Promise(r => setTimeout(r, 10));

        expect(global.fetch).toHaveBeenCalledWith('/api/v1/offerings?project=project-b&available=true');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
