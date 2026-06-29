import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

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

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const { mockRouter, mockRoute, mockHasPermission } = vi.hoisted(() => {
    return {
        mockRouter: { push: vi.fn(), replace: vi.fn() },
        mockRoute: { params: { entity: 'aenderungslog' }, query: {} },
        mockHasPermission: vi.fn(() => true)
    };
});

vi.mock('../../stores/auth.js', () => ({
    useAuthStore: () => ({
        token: 'fake-token',
        isAuthenticated: true,
        user: { username: 'admin', permissions: { changelog: { read: 'all' } } },
        permissions: { changelog: { read: 'all' } },
        hasPermission: mockHasPermission,
        hasItemPermission: vi.fn(() => true),
        logout: vi.fn()
    })
}));

vi.mock('vue-router', () => ({
    useRouter: () => mockRouter,
    useRoute: () => mockRoute,
    RouterLink: {
        template: '<a><slot /></a>',
        props: ['to']
    }
}));

const mockChangelogItems = [
    {
        _id: 'log1',
        timestamp: '2026-06-28T10:00:00Z',
        user: 'admin',
        resource: 'trees',
        action: 'create',
        documentId: 'doc1',
        documentSlug: 'eiche',
        diff: null
    },
    {
        _id: 'log2',
        timestamp: '2026-06-28T11:00:00Z',
        user: 'editor',
        resource: 'orders',
        action: 'update',
        documentId: 'doc2',
        documentSlug: 'GPT-2026-0001',
        diff: { status: { from: 'neu', to: 'bestätigt' } }
    },
    {
        _id: 'log3',
        timestamp: '2026-06-28T12:00:00Z',
        user: 'admin',
        resource: 'trees',
        action: 'delete',
        documentId: 'doc3',
        documentSlug: 'birke',
        diff: null
    }
];

// We need to import after mocks are set up
// The component imports AdminLayout which imports stores
vi.mock('../../components/admin/AdminLayout.vue', () => ({
    default: {
        template: '<div class="admin-layout-stub"><slot /></div>',
        name: 'AdminLayout'
    }
}));

import ChangelogPage from '../admin/ChangelogPage.vue';

describe('ChangelogPage.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const store = { token: 'fake-token' };
        global.localStorage = {
            getItem: vi.fn(key => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = String(val); }),
            removeItem: vi.fn(key => { delete store[key]; }),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        };

        global.fetch = vi.fn((url) => {
            if (url.includes('/changelog/distinct/resource')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(['orders', 'trees'])
                });
            }
            if (url.includes('/changelog?') || url.endsWith('/changelog')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: mockChangelogItems,
                        total: 3
                    })
                });
            }
            if (url.includes('/changelog/doc1')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        {
                            _id: 'log1',
                            user: 'admin',
                            resource: 'trees',
                            action: 'create',
                            documentId: 'doc1',
                            documentSlug: 'eiche',
                            before: null,
                            after: { name: 'Eiche', slug: 'eiche', category: 'Laubbaum' }
                        }
                    ])
                });
            }
            if (url.includes('/config/entities')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { configName: 'tree', slug: 'baeume', resource: 'trees', label: { plural: 'Bäume' }, icon: 'TreePine' },
                        { configName: 'order', slug: 'bestellungen', resource: 'orders', label: { plural: 'Bestellungen' }, icon: 'ShoppingCart' }
                    ])
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });
    });

    const mountPage = async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        // Pre-load entities since AdminLayout is stubbed and won't call fetchEntities
        const { useConfigStore } = await import('../../stores/config.js');
        const configStore = useConfigStore();
        configStore.entities = [
            { configName: 'tree', slug: 'baeume', resource: 'trees', label: { plural: 'Bäume' }, icon: 'TreePine' },
            { configName: 'order', slug: 'bestellungen', resource: 'orders', label: { plural: 'Bestellungen' }, icon: 'ShoppingCart' }
        ];
        configStore.loaded = true;

        const wrapper = mount(ChangelogPage, {
            global: {
                plugins: [pinia],
                stubs: ['wa-button', 'wa-icon', 'wa-dialog', 'router-link']
            }
        });

        await flushPromises();
        return wrapper;
    };

    it('renders changelog list with items', async () => {
        const wrapper = await mountPage();

        expect(wrapper.text()).toContain('Änderungslog');
        expect(wrapper.text()).toContain('3 Einträge');

        // Should display items in a table
        const rows = wrapper.findAll('.data-table tbody tr');
        expect(rows).toHaveLength(3);
    });

    it('displays action badges with correct labels', async () => {
        const wrapper = await mountPage();

        const badges = wrapper.findAll('.action-badge');
        expect(badges).toHaveLength(3);

        expect(badges[0].text()).toBe('Erstellt');
        expect(badges[1].text()).toBe('Geändert');
        expect(badges[2].text()).toBe('Gelöscht');
    });

    it('displays action badges with correct CSS classes', async () => {
        const wrapper = await mountPage();

        const badges = wrapper.findAll('.action-badge');
        expect(badges[0].classes()).toContain('create');
        expect(badges[1].classes()).toContain('update');
        expect(badges[2].classes()).toContain('delete');
    });

    it('shows diff summary for update entries', async () => {
        const wrapper = await mountPage();

        // The update entry should show the changed field name
        expect(wrapper.text()).toContain('status');
    });

    it('does not show edit, delete, or create buttons', async () => {
        const wrapper = await mountPage();

        // No Neu/Create button, no Löschen/Delete button, no edit pencil icons
        expect(wrapper.findAll('wa-button-stub').length).toBe(0);
        expect(wrapper.findAll('.btn-icon')).toHaveLength(0);
    });

    it('shows detail view on row click', async () => {
        const wrapper = await mountPage();

        // Click first row (create action)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[0].trigger('click');
        await flushPromises();

        // Should show detail view
        expect(wrapper.find('.changelog-detail').exists()).toBe(true);
        expect(wrapper.find('.changelog-list').exists()).toBe(false);

        // Should show meta information
        expect(wrapper.text()).toContain('admin');
        expect(wrapper.text()).toContain('trees');
        expect(wrapper.text()).toContain('eiche');
    });

    it('shows diff table for update entries in detail view', async () => {
        const wrapper = await mountPage();

        // Click second row (update action)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[1].trigger('click');
        await flushPromises();

        // Should show diff table
        expect(wrapper.find('.diff-table').exists()).toBe(true);
        expect(wrapper.text()).toContain('status');
        expect(wrapper.text()).toContain('neu');
        expect(wrapper.text()).toContain('bestätigt');
    });

    it('lazy-loads snapshot data for create entries', async () => {
        const wrapper = await mountPage();

        // Click first row (create action)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[0].trigger('click');
        await flushPromises();

        // Should have fetched the detail endpoint
        const detailCalls = fetch.mock.calls.filter(c => c[0].includes('/changelog/doc1'));
        expect(detailCalls.length).toBeGreaterThan(0);

        // Should show the snapshot table with data
        expect(wrapper.find('.snapshot-table').exists()).toBe(true);
        expect(wrapper.text()).toContain('Eiche');
        expect(wrapper.text()).toContain('Laubbaum');
    });

    it('returns to list view when back button is clicked', async () => {
        const wrapper = await mountPage();

        // Go to detail
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[1].trigger('click');
        await flushPromises();

        expect(wrapper.find('.changelog-detail').exists()).toBe(true);

        // Click back button
        await wrapper.find('.btn-back').trigger('click');
        await flushPromises();

        // Should be back in list view
        expect(wrapper.find('.changelog-list').exists()).toBe(true);
        expect(wrapper.find('.changelog-detail').exists()).toBe(false);
    });

    it('loads resource filter options from distinct endpoint', async () => {
        const wrapper = await mountPage();

        // Verify distinct endpoint was called
        const distinctCalls = fetch.mock.calls.filter(c => c[0].includes('/distinct/resource'));
        expect(distinctCalls.length).toBe(1);

        // Filter dropdown should have options
        const select = wrapper.find('.generic-filter');
        const options = select.findAll('option');
        // "Ressource: alle" + "orders" + "trees"
        expect(options.length).toBeGreaterThanOrEqual(3);
    });

    it('applies resource filter when changed', async () => {
        const wrapper = await mountPage();

        // Clear previous calls
        fetch.mockClear();

        // Set filter
        wrapper.vm.filterResource = 'trees';
        await flushPromises();

        // Should have reloaded with filter
        const calls = fetch.mock.calls.filter(c => c[0].includes('resource=trees'));
        expect(calls.length).toBe(1);
    });

    it('applies action filter when changed', async () => {
        const wrapper = await mountPage();

        fetch.mockClear();

        wrapper.vm.filterAction = 'delete';
        await flushPromises();

        const calls = fetch.mock.calls.filter(c => c[0].includes('action=delete'));
        expect(calls.length).toBe(1);
    });

    it('shows object link for create entries', async () => {
        const wrapper = await mountPage();

        // Click first row (create action on trees)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[0].trigger('click');
        await flushPromises();

        const link = wrapper.find('.object-link');
        expect(link.exists()).toBe(true);
        expect(link.attributes('to')).toBe('/admin/baeume');
    });

    it('shows object link for update entries', async () => {
        const wrapper = await mountPage();

        // Click second row (update action on orders)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[1].trigger('click');
        await flushPromises();

        const link = wrapper.find('.object-link');
        expect(link.exists()).toBe(true);
        expect(link.attributes('to')).toBe('/admin/bestellungen');
    });

    it('does not show object link for delete entries', async () => {
        const wrapper = await mountPage();

        // Click third row (delete action)
        const rows = wrapper.findAll('.data-table tbody tr');
        await rows[2].trigger('click');
        await flushPromises();

        const link = wrapper.find('.object-link');
        expect(link.exists()).toBe(false);
    });
});
