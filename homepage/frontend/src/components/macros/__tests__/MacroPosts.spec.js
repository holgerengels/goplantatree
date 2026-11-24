import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import MacroPosts from '../MacroPosts.vue';

let mockRoute;
let mockPosts;
let mockFetchPosts;

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    RouterLink: { template: '<a><slot /></a>' }
}));

vi.mock('../../../stores/posts.js', () => ({
    usePostsStore: () => ({
        posts: mockPosts,
        fetchPosts: mockFetchPosts
    })
}));

// Stub PostCard to avoid deep dependencies
vi.mock('../../blog/PostCard.vue', () => ({
    default: {
        props: ['post'],
        template: '<div class="post-card">{{ post.title }} ({{ post.project || "none" }})</div>'
    }
}));

describe('MacroPosts.vue', () => {
    beforeEach(() => {
        mockRoute = reactive({ query: {} });
        mockPosts = [
            { _id: '1', title: 'Post 1', type: 'pflanzung', project: 'ulm' },
            { _id: '2', title: 'Post 2', type: 'pflanzung', project: 'augsburg' },
            { _id: '3', title: 'Post 3', type: 'news', project: 'ulm' }
        ];
        mockFetchPosts = vi.fn().mockImplementation((params) => {
            return Promise.resolve();
        });
    });

    it('fetches posts on mount with default props', async () => {
        const wrapper = mount(MacroPosts, {
            global: { stubs: ['router-link'] }, props: { limit: 5, type: 'pflanzung' }
        });
        await flushPromises();

        expect(mockFetchPosts).toHaveBeenCalledWith({
            limit: 5,
            type: 'pflanzung',
            project: undefined
        });
    });

    it('fetches and filters by route.query.project when syncQuery is true (default)', async () => {
        mockRoute.query = { project: 'ulm' };
        const wrapper = mount(MacroPosts, {
            global: { stubs: ['router-link'] }, props: { limit: 5, type: 'pflanzung' }
        });
        await flushPromises();

        expect(mockFetchPosts).toHaveBeenCalledWith({
            limit: 5,
            type: 'pflanzung',
            project: 'ulm'
        });

        const cards = wrapper.findAll('.post-card');
        expect(cards.length).toBe(1);
        expect(cards[0].text()).toContain('Post 1 (ulm)');
    });

    it('static project prop takes precedence over route query', async () => {
        mockRoute.query = { project: 'ulm' };
        const wrapper = mount(MacroPosts, {
            global: { stubs: ['router-link'] }, props: { limit: 5, type: 'pflanzung', project: 'augsburg' }
        });
        await flushPromises();

        expect(mockFetchPosts).toHaveBeenCalledWith({
            limit: 5,
            type: 'pflanzung',
            project: 'augsburg'
        });

        const cards = wrapper.findAll('.post-card');
        expect(cards.length).toBe(1);
        expect(cards[0].text()).toContain('Post 2 (augsburg)');
    });

    it('re-fetches automatically when route.query.project changes', async () => {
        const wrapper = mount(MacroPosts, {
            global: { stubs: ['router-link'] }, props: { limit: 5, type: 'pflanzung' }
        });
        await flushPromises();

        expect(mockFetchPosts).toHaveBeenCalledWith({
            limit: 5,
            type: 'pflanzung',
            project: undefined
        });

        // Update route query
        mockRoute.query = { project: 'ulm' };
        await flushPromises();

        expect(mockFetchPosts).toHaveBeenCalledWith({
            limit: 5,
            type: 'pflanzung',
            project: 'ulm'
        });
    });
});
