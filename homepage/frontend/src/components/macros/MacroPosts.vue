<template>
  <div class="macro-posts">
    <div class="posts-grid" v-if="loadedPosts.length">
      <PostCard v-for="post in loadedPosts" :key="post._id" :post="post" />
    </div>
    <div v-else-if="loading" class="loading-posts">
      Wird geladen...
    </div>
    <div v-else class="no-posts">
      Keine Beiträge gefunden.
    </div>

    <div class="section-actions" v-if="loadedPosts.length && actionLabel && actionLink">
      <router-link :to="actionLink" class="btn btn-secondary">
        {{ actionLabel }} →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePostsStore } from '../../stores/posts.js';
import PostCard from '../blog/PostCard.vue';

const props = defineProps({
    limit: {
        type: Number,
        default: 3
    },
    type: {
        type: String,
        default: '' // 'news' or 'pflanzung' or empty for all
    },
    project: {
        type: String,
        default: '' // Static project slug (overrides URL query)
    },
    syncQuery: {
        type: Boolean,
        default: true // Whether to sync with ?project= query if no static project is set
    },
    actionLabel: {
        type: String,
        default: ''
    },
    actionLink: {
        type: String,
        default: ''
    }
});

const route = useRoute();
const postsStore = usePostsStore();
const loading = ref(true);

const effectiveProject = computed(() => {
    if (props.project) return props.project;
    if (props.syncQuery && route?.query?.project) {
        const q = route.query.project;
        return Array.isArray(q) ? q[0] : String(q);
    }
    return '';
});

watch(
    () => [props.limit, props.type, effectiveProject.value],
    async ([limit, type, project]) => {
        loading.value = true;
        await postsStore.fetchPosts({
            limit,
            type: type || undefined,
            project: project || undefined
        });
        loading.value = false;
    },
    { immediate: true }
);

const loadedPosts = computed(() => {
    let list = postsStore.posts || [];
    if (props.type) {
        list = list.filter((p) => p.type === props.type);
    }
    if (effectiveProject.value) {
        list = list.filter((p) => p.project === effectiveProject.value);
    }
    return list.slice(0, props.limit);
});
</script>

<style scoped>
.macro-posts {
    width: 100%;
}

.posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-xl);
}

.loading-posts, .no-posts {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--space-xl);
}
</style>
