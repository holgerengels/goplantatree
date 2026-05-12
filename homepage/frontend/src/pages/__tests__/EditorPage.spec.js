import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import EditorPage from '../EditorPage.vue';
import { createPinia, setActivePinia } from 'pinia';
import * as vueRouter from 'vue-router';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('../../store/authStore.js', () => ({
    useAuthStore: () => ({
        token: 'fake-token',
        user: { permissions: { orders: { create: 'all', read: 'all', delete: 'all' } } },
        hasPermission: () => true
    })
}));

const { mockRouter, mockRoute } = vi.hoisted(() => {
    return {
        mockRouter: { push: vi.fn(), replace: vi.fn() },
        mockRoute: { params: { entity: 'bestellungen' }, query: {} }
    };
});

vi.mock('vue-router', () => ({
    useRouter: () => mockRouter,
    useRoute: () => mockRoute
}));

describe('EditorPage.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRoute.params.entity = 'bestellungen';

        global.fetch = vi.fn((url) => {
            if (url.includes('/api/v1/config/entities')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { name: 'Bestellungen', configName: 'order', slug: 'bestellungen', resource: 'orders' }
                    ])
                });
            }
            if (url.includes('/api/v1/config/order')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        entity: 'order',
                        api: '/api/v1/orders',
                        resource: 'orders',
                        label: { singular: 'Bestellung', plural: 'Bestellungen' },
                        fields: [
                            { name: 'name', label: 'Name', type: 'Text', required: true }
                        ]
                    })
                });
            }
            if (url.includes('/api/v1/orders')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ items: [], total: 0 })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });
        
        global.confirm = vi.fn(() => true);
    });

    it('renders and allows starting creation', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-button', 'wa-icon', 'DynamicForm', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        // Let async setup loadConfig complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Start creation
        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();

        // Form actions should now be visible
        expect(wrapper.vm.editing).toBe(true);
    });

    it('blocks saving if validation fails and shows error', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start creation
        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();

        // Trigger save
        await wrapper.vm.save();
        await wrapper.vm.$nextTick();

        // api.post (via fetch) should NOT be called due to validation
        const postCalls = fetch.mock.calls.filter(c => c[1]?.method === 'POST');
        expect(postCalls.length).toBe(0);

        // Validation error should be present in the UI
        expect(wrapper.text()).toContain('Name ist ein Pflichtfeld');
    });

    it('saves successfully if validation passes', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start creation
        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();

        // Fill out required field 'name'
        wrapper.vm.formData.name = 'Valid Name';
        await wrapper.vm.$nextTick();

        // Save
        await wrapper.vm.save();
        await wrapper.vm.$nextTick();

        // api.post calls go through the api service which uses fetch internally
        const postCalls = fetch.mock.calls.filter(c => c[1]?.method === 'POST');
        expect(postCalls.length).toBe(1);
        expect(postCalls[0][0]).toBe('/api/v1/orders');
        
        const body = JSON.parse(postCalls[0][1].body);
        expect(body.name).toBe('Valid Name');
    });
});
