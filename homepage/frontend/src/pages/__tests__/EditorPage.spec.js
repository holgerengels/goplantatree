import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
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

const { mockRouter, mockRoute, mockUser, mockPermissions, mockHasPermission, mockHasItemPermission, mockConfirm } = vi.hoisted(() => {
    return {
        mockRouter: { push: vi.fn(), replace: vi.fn() },
        mockRoute: { params: { entity: 'bestellungen' }, query: {} },
        mockUser: {
            permissions: { orders: { create: 'all', read: 'all', delete: 'all', update: 'all' } },
            project: 'user-proj-123'
        },
        mockPermissions: { orders: { create: 'all', read: 'all', delete: 'all', update: 'all' } },
        mockHasPermission: vi.fn(() => true),
        mockHasItemPermission: vi.fn(() => true),
        mockConfirm: vi.fn(() => Promise.resolve(true))
    };
});

vi.mock('../../stores/auth.js', () => ({
    useAuthStore: () => ({
        token: 'fake-token',
        isAuthenticated: true,
        user: mockUser,
        permissions: mockPermissions,
        hasPermission: mockHasPermission,
        hasItemPermission: mockHasItemPermission
    })
}));

vi.mock('vue-router', () => ({
    useRouter: () => mockRouter,
    useRoute: () => mockRoute
}));

vi.mock('../../composables/useToast.js', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn()
    },
    confirm: mockConfirm
}));

describe('EditorPage.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRoute.params.entity = 'bestellungen';
        
        // Reset mocks to defaults
        mockUser.permissions = { orders: { create: 'all', read: 'all', delete: 'all', update: 'all' } };
        mockUser.project = 'user-proj-123';
        mockPermissions.orders = { create: 'all', read: 'all', delete: 'all', update: 'all' };
        mockHasPermission.mockImplementation(() => true);
        mockHasItemPermission.mockImplementation(() => true);
        mockConfirm.mockResolvedValue(true);

        // Mock localStorage
        const store = { token: 'fake-token' };
        global.localStorage = {
            getItem: vi.fn(key => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = String(val); }),
            removeItem: vi.fn(key => { delete store[key]; }),
            clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
            length: 0,
            key: vi.fn()
        };

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
                            { name: 'name', label: 'Name', type: 'Text', required: true },
                            { name: 'project', label: 'Projekt', type: 'Relation' }
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
        await flushPromises();

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

        await flushPromises();
        
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

        await flushPromises();
        
        // Start creation
        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();

        // Fill out required field 'name'
        wrapper.vm.formData.name = 'Valid Name';
        await wrapper.vm.$nextTick();

        // Save (default stays in editor)
        await wrapper.vm.save(false);
        await wrapper.vm.$nextTick();

        // api.post calls go through the api service which uses fetch internally
        const postCalls = fetch.mock.calls.filter(c => c[1]?.method === 'POST');
        expect(postCalls.length).toBe(1);
        expect(postCalls[0][0]).toBe('/api/v1/orders');
        
        const body = JSON.parse(postCalls[0][1].body);
        expect(body.name).toBe('Valid Name');
        // Still in editor view
        expect(wrapper.vm.editing).toBe(true);
    });

    it('saves and closes when andClose is true', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();
        wrapper.vm.formData.name = 'Valid Name';
        await wrapper.vm.$nextTick();

        await wrapper.vm.save(true);
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.editing).toBe(false);
    });

    it('pre-fills project on create when permission is scoped to own', async () => {
        mockUser.permissions = { orders: { create: 'own', read: 'own', delete: 'own', update: 'own' } };
        mockUser.project = 'user-proj-123';
        mockPermissions.orders = { create: 'own', read: 'own', delete: 'own', update: 'own' };
        mockHasPermission.mockImplementation((res, act) => act === 'create');

        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        // Start creation
        wrapper.vm.startCreate();
        await wrapper.vm.$nextTick();

        // Project should be prefilled with user project
        expect(wrapper.vm.formData.project).toBe('user-proj-123');
    });

    it('enforces item-level permissions and makes fields readonly accordingly', async () => {
        mockUser.permissions = { orders: { create: 'own', read: 'own', delete: 'own', update: 'own' } };
        mockUser.project = 'user-proj-123';
        mockPermissions.orders = { create: 'own', read: 'own', delete: 'own', update: 'own' };
        
        mockHasItemPermission.mockImplementation((res, act, item) => {
            if (act === 'update' || act === 'delete') {
                return item.project === 'user-proj-123';
            }
            return true;
        });

        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        // Item 1 (belongs to user project)
        const item1 = { _id: 'item1', name: 'Order 1', project: 'user-proj-123' };
        // Item 2 (belongs to other project)
        const item2 = { _id: 'item2', name: 'Order 2', project: 'other-proj' };

        // Test editing item 1 (allowed)
        wrapper.vm.startEdit(item1);
        await wrapper.vm.$nextTick();
        
        // project field should be readonly because update permission is 'own' (not 'all')
        const formFields1 = wrapper.findComponent({ name: 'DynamicForm' }).vm.evaluatedFields;
        const projectField1 = formFields1.find(f => f.name === 'project');
        expect(projectField1.readonly).toBe(true);

        // name field should NOT be readonly
        const nameField1 = formFields1.find(f => f.name === 'name');
        expect(nameField1.readonly).toBeUndefined();

        // Test editing item 2 (disallowed)
        wrapper.vm.startEdit(item2);
        await wrapper.vm.$nextTick();

        // all fields should be readonly because the item belongs to another project
        const formFields2 = wrapper.findComponent({ name: 'DynamicForm' }).vm.evaluatedFields;
        const nameField2 = formFields2.find(f => f.name === 'name');
        const projectField2 = formFields2.find(f => f.name === 'project');
        expect(nameField2.readonly).toBe(true);
        expect(projectField2.readonly).toBe(true);
    });

    it('deletes successfully if user confirms', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        // Start editing an item so editingId is set
        const item = { _id: 'item123', name: 'Order to delete' };
        wrapper.vm.startEdit(item);
        await wrapper.vm.$nextTick();

        // Set confirm mock to true
        mockConfirm.mockResolvedValue(true);

        // Mock fetch delete request
        global.fetch = vi.fn((url, options) => {
            if (options?.method === 'DELETE') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        // Trigger remove
        await wrapper.vm.remove();
        await flushPromises();

        // Verify confirm was called
        expect(mockConfirm).toHaveBeenCalled();

        // Verify fetch DELETE request was made
        const deleteCalls = fetch.mock.calls.filter(c => c[1]?.method === 'DELETE');
        expect(deleteCalls.length).toBe(1);
        expect(deleteCalls[0][0]).toBe('/api/v1/orders/item123');
    });

    it('does not delete if user cancels confirmation', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        // Start editing
        const item = { _id: 'item123', name: 'Order to delete' };
        wrapper.vm.startEdit(item);
        await wrapper.vm.$nextTick();

        // Set confirm mock to false
        mockConfirm.mockResolvedValue(false);

        // Reset fetch mock calls
        global.fetch = vi.fn();

        // Trigger remove
        await wrapper.vm.remove();
        await flushPromises();

        expect(mockConfirm).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('selects multiple items and deletes them successfully', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select']
            }
        });

        await flushPromises();

        // Populate items in component
        wrapper.vm.items = [
            { _id: 'item1', name: 'Order 1' },
            { _id: 'item2', name: 'Order 2' }
        ];
        await wrapper.vm.$nextTick();

        // Expect items to be loaded and initially selectedIds is empty
        expect(wrapper.vm.selectedIds.length).toBe(0);

        // Select all selectable items
        wrapper.vm.toggleSelectAll();
        await wrapper.vm.$nextTick();

        // Verify selectedIds is populated
        expect(wrapper.vm.selectedIds).toEqual(['item1', 'item2']);

        // Set confirm mock to true
        mockConfirm.mockResolvedValue(true);

        // Mock fetch DELETE request for bulk-delete
        global.fetch = vi.fn((url, options) => {
            if (options?.method === 'DELETE') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        // Trigger deleteSelected
        await wrapper.vm.deleteSelected();
        await flushPromises();

        // Verify confirmation dialog was prompted
        expect(mockConfirm).toHaveBeenCalled();

        // Verify fetch DELETE request was made on collection root endpoint with body
        const deleteCalls = fetch.mock.calls.filter(c => c[1]?.method === 'DELETE');
        expect(deleteCalls.length).toBe(1);
        expect(deleteCalls[0][0]).toBe('/api/v1/orders');
        expect(JSON.parse(deleteCalls[0][1].body)).toEqual({ ids: ['item1', 'item2'] });
    });

    it('handles import file preview and result with skippedItems', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select', 'wa-spinner', 'wa-badge', 'wa-button']
            }
        });

        await flushPromises();

        // Enable allowImport on config
        wrapper.vm.config = {
            ...wrapper.vm.config,
            admin: { ...wrapper.vm.config?.admin, allowImport: true }
        };

        // Open import dialog
        wrapper.vm.openImportDialog();
        expect(wrapper.vm.showImportDialog).toBe(true);

        // Mock file selection and preview fetch
        const file = new File(['E-Mail,Name\ntest@example.com,Test'], 'subscribers.csv', { type: 'text/csv' });
        wrapper.vm.selectedFile = file;

        global.fetch = vi.fn((url) => {
            if (url.includes('/import?preview=true')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        totalRows: 2,
                        headers: ['E-Mail', 'Name', 'data.tree'],
                        preview: [
                            { rowNum: 2, data: { email: 'test@example.com', name: 'Test', data: { tree: 'Eiche' } } }
                        ]
                    })
                });
            }
            if (url.includes('/import')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        imported: 1,
                        skipped: 1,
                        skippedItems: [
                            { row: 3, email: 'dup@example.com', name: 'Dup User', reason: 'E-Mail existiert bereits in diesem Projekt' }
                        ],
                        errors: []
                    })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        });

        // Trigger loadPreview
        await wrapper.vm.loadPreview();
        await flushPromises();

        expect(wrapper.vm.previewData).not.toBeNull();
        expect(wrapper.vm.previewData.totalRows).toBe(2);
        expect(wrapper.vm.previewData.preview[0].data.data.tree).toBe('Eiche');

        // Trigger uploadFile
        await wrapper.vm.uploadFile();
        await flushPromises();

        expect(wrapper.vm.importResult).not.toBeNull();
        expect(wrapper.vm.importResult.imported).toBe(1);
        expect(wrapper.vm.importResult.skipped).toBe(1);
        expect(wrapper.vm.importResult.skippedItems).toHaveLength(1);
        expect(wrapper.vm.importResult.skippedItems[0].email).toBe('dup@example.com');
    });

    it('requests paged list format and paginates by total', async () => {
        const listUrls = [];
        const baseFetch = global.fetch;
        global.fetch = vi.fn((url, opts) => {
            if (url.includes('/api/v1/orders') && !url.includes('/config/')) {
                listUrls.push(url);
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: Array.from({ length: 100 }, (_, i) => ({ _id: `o${i}`, name: `Order ${i}` })),
                        total: 366
                    })
                });
            }
            return baseFetch(url, opts);
        });

        const pinia = createPinia();
        setActivePinia(pinia);

        const wrapper = mount(EditorPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-icon', 'wa-dialog', 'wa-input', 'wa-select', 'wa-spinner', 'wa-badge', 'wa-button', 'DynamicForm']
            }
        });
        await flushPromises();

        // Contract with backend: without paged=true the API returns a plain array without total
        expect(listUrls.length).toBeGreaterThan(0);
        const firstParams = new URL(listUrls.at(-1), 'http://x').searchParams;
        expect(firstParams.get('paged')).toBe('true');
        expect(firstParams.get('limit')).toBe('100');
        expect(firstParams.has('skip')).toBe(false);

        expect(wrapper.vm.totalCount).toBe(366);
        expect(wrapper.vm.totalPages).toBe(4);
        expect(wrapper.find('.pagination').exists()).toBe(true);
        expect(wrapper.find('.pagination-info').text()).toContain('Seite 1 von 4');

        // Next page requests skip=100
        wrapper.vm.goToPage(2);
        await flushPromises();
        const nextParams = new URL(listUrls.at(-1), 'http://x').searchParams;
        expect(nextParams.get('paged')).toBe('true');
        expect(nextParams.get('skip')).toBe('100');
    });
});

