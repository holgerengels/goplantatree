import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ContentPage from '../ContentPage.vue';
import { api } from '../../services/api.js';

vi.mock('../../composables/useJsonLd.js', () => ({
    useJsonLd: vi.fn()
}));

vi.mock('../../composables/useHead.js', () => ({
    useHead: vi.fn()
}));

const mockRoute = {
    params: { slug: 'test-page' },
    meta: {}
};

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    RouterLink: {
        template: '<a><slot /></a>',
        props: ['to']
    }
}));

vi.mock('../../services/api.js', () => ({
    api: {
        get: vi.fn()
    }
}));

describe('ContentPage.vue Hero Integration', () => {
    let pinia;

    beforeEach(() => {
        vi.clearAllMocks();
        pinia = createPinia();
        setActivePinia(pinia);
    });

    it('renders HeroSection with #actions when heroContent is present', async () => {
        api.get.mockResolvedValueOnce({
            title: 'Pflanzblog',
            slug: 'blog',
            heroSubtitle: 'Unsere Pflanzungen',
            heroContent: '<p>[[post-submit type="pflanzung"]]</p>',
            content: '<p>Hauptinhalt</p>',
            published: true
        });

        const wrapper = mount(ContentPage, {
            global: {
                plugins: [pinia],
                stubs: {
                    HeroSection: {
                        template: `
                            <div class="hero-stub">
                                <h1>{{ title }}</h1>
                                <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
                                <div class="hero-actions-stub"><slot name="actions" /></div>
                            </div>
                        `,
                        props: ['title', 'subtitle', 'backgroundImage', 'height']
                    },
                    DynamicContent: {
                        template: '<div class="dynamic-content-stub">{{ content }}</div>',
                        props: ['content']
                    },
                    SectionNav: true
                }
            }
        });

        await flushPromises();

        expect(wrapper.find('.hero-stub').exists()).toBe(true);
        expect(wrapper.find('.hero-stub h1').text()).toBe('Pflanzblog');
        expect(wrapper.find('.subtitle').text()).toBe('Unsere Pflanzungen');
        expect(wrapper.find('.hero-actions-stub').exists()).toBe(true);
        expect(wrapper.find('.hero-actions-stub').text()).toContain('[[post-submit type="pflanzung"]]');
        // Main content wrapper should not contain duplicate h1
        expect(wrapper.find('.content-wrapper h1').exists()).toBe(false);
    });

    it('renders HeroSection when only heroContent is set (without heroSubtitle)', async () => {
        api.get.mockResolvedValueOnce({
            title: 'Aktion',
            slug: 'aktion',
            heroContent: '<button class="btn">Klick mich</button>',
            content: '<p>Aktionsinhalt</p>',
            published: true
        });

        const wrapper = mount(ContentPage, {
            global: {
                plugins: [pinia],
                stubs: {
                    HeroSection: {
                        template: `
                            <div class="hero-stub">
                                <h1>{{ title }}</h1>
                                <div class="hero-actions-stub"><slot name="actions" /></div>
                            </div>
                        `,
                        props: ['title', 'subtitle', 'backgroundImage', 'height']
                    },
                    DynamicContent: {
                        template: '<div class="dynamic-content-stub">{{ content }}</div>',
                        props: ['content']
                    },
                    SectionNav: true
                }
            }
        });

        await flushPromises();

        expect(wrapper.find('.hero-stub').exists()).toBe(true);
        expect(wrapper.find('.hero-actions-stub').text()).toContain('<button class="btn">Klick mich</button>');
        expect(wrapper.find('.content-wrapper h1').exists()).toBe(false);
    });

    it('does not render HeroSection when neither heroSubtitle nor heroContent is set', async () => {
        api.get.mockResolvedValueOnce({
            title: 'Impressum',
            slug: 'impressum',
            content: '<p>Verantwortlich...</p>',
            published: true
        });

        const wrapper = mount(ContentPage, {
            global: {
                plugins: [pinia],
                stubs: {
                    HeroSection: {
                        template: '<div class="hero-stub"></div>'
                    },
                    DynamicContent: {
                        template: '<div class="dynamic-content-stub">{{ content }}</div>',
                        props: ['content']
                    },
                    SectionNav: true
                }
            }
        });

        await flushPromises();

        expect(wrapper.find('.hero-stub').exists()).toBe(false);
        // H1 should be rendered in content section instead
        expect(wrapper.find('.content-wrapper h1').exists()).toBe(true);
        expect(wrapper.find('.content-wrapper h1').text()).toBe('Impressum');
    });

    it('loads specific templateSlug if present, falling back to detail-<entity>', async () => {
        // Mock configStore
        api.get.mockImplementation(async (url) => {
            if (url === '/config/entities') {
                return [{ configName: 'post', slug: 'blog' }];
            }
            if (url === '/config/post') {
                return {
                    entity: 'post',
                    slug: 'blog',
                    api: '/api/v1/posts',
                    fields: [{ name: 'content', type: 'RichText' }],
                    public: {}
                };
            }
            if (url === '/posts/mein-baum') {
                return {
                    title: 'Mein Baum',
                    type: 'pflanzung',
                    content: '<p>Gepflanzt</p>'
                };
            }
            if (url === '/pages/detail-pflanzblog') {
                throw new Error('Not found');
            }
            if (url === '/pages/detail-blog') {
                return {
                    title: '{{title}}',
                    slug: 'detail-blog',
                    content: 'Detail: {{content}}',
                    published: true
                };
            }
            throw new Error(`Unexpected url: ${url}`);
        });

        const wrapper = mount(ContentPage, {
            props: {
                entity: 'blog',
                id: 'mein-baum',
                templateSlug: 'detail-pflanzblog'
            },
            global: {
                plugins: [pinia],
                stubs: {
                    HeroSection: true,
                    DynamicContent: {
                        template: '<div class="dynamic-content-stub">{{ content }}</div>',
                        props: ['content']
                    },
                    SectionNav: true
                }
            }
        });

        await flushPromises();

        expect(api.get).toHaveBeenCalledWith('/pages/detail-pflanzblog');
        expect(api.get).toHaveBeenCalledWith('/pages/detail-blog');
        expect(wrapper.text()).toContain('Detail: <p>Gepflanzt</p>');
    });
});
