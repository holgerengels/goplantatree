import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api.js';

/**
 * Posts store — manages blog entries (formerly "articles").
 */
export const usePostsStore = defineStore('posts', () => {
    const posts = ref([]);
    const currentPost = ref(null);
    const loading = ref(false);

    const fetchPosts = async (params = {}) => {
        loading.value = true;
        try {
            const query = new URLSearchParams();
            if (params.project) query.set('project', params.project);
            if (params.type) query.set('type', params.type);
            if (params.limit) query.set('limit', params.limit);

            posts.value = await api.get(`/posts?${query.toString()}`);
        } finally {
            loading.value = false;
        }
    };

    const fetchPost = async (slug) => {
        loading.value = true;
        try {
            currentPost.value = await api.get(`/posts/${slug}`);
            return currentPost.value;
        } finally {
            loading.value = false;
        }
    };

    return { posts, currentPost, loading, fetchPosts, fetchPost };
});
