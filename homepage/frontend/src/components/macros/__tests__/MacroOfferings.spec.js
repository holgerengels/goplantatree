import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MacroOfferings from '../MacroOfferings.vue';

// Mock the api service
vi.mock('../../../services/api.js', () => ({
    api: {
        get: vi.fn()
    }
}));

import { api } from '../../../services/api.js';

describe('MacroOfferings.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches offerings on mount and renders them', async () => {
        const mockOfferings = [
            { _id: '1', name: 'Tree 1', category: 'Laubbaum', tree: { slug: 't1' }, image: { url: 'img1.jpg' } },
            { _id: '2', name: 'Tree 2', category: 'Obstbaum', tree: {} }
        ];

        api.get.mockImplementation((url) => {
            if (url.startsWith('/offerings')) return Promise.resolve(mockOfferings);
            if (url.startsWith('/trees')) return Promise.resolve([]);
            return Promise.resolve([]);
        });

        const wrapper = mount(MacroOfferings, {
            props: { project: 'test-project' },
            global: {
                stubs: ['router-link']
            }
        });

        // Wait for the immediate watch and fetch to resolve
        await vi.dynamicImportSettled();
        await new Promise(r => setTimeout(r, 10));

        expect(api.get).toHaveBeenCalledWith('/offerings?project=test-project&available=true');
        expect(api.get).toHaveBeenCalledWith('/trees');
        expect(api.get).toHaveBeenCalledTimes(2);

        const cards = wrapper.findAll('.offering-card');
        expect(cards.length).toBe(2);
        expect(wrapper.text()).toContain('Tree 1');
        expect(wrapper.text()).toContain('Tree 2');
    });

    it('refetches when project prop changes', async () => {
        api.get.mockResolvedValue([]);

        const wrapper = mount(MacroOfferings, {
            props: { project: 'project-a' },
            global: {
                stubs: ['router-link']
            }
        });

        await new Promise(r => setTimeout(r, 10));
        expect(api.get).toHaveBeenCalledWith('/offerings?project=project-a&available=true');

        // Change prop
        await wrapper.setProps({ project: 'project-b' });
        await new Promise(r => setTimeout(r, 10));

        expect(api.get).toHaveBeenCalledWith('/offerings?project=project-b&available=true');
        expect(api.get).toHaveBeenCalledWith('/trees');
        expect(api.get).toHaveBeenCalledTimes(4);
    });
});
