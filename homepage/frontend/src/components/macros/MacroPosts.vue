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
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
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
    }
});

const postsStore = usePostsStore();
const loading = ref(true);

watch(() => [props.limit, props.type], async ([limit, type]) => {
    // If the store already has posts and we don't need a specific filter, we might just use them.
    // However, to be safe and respect limits/types, we fetch them via the store's fetch method
    await postsStore.fetchPosts({ limit, type: type || undefined });
    loading.value = false;
}, { immediate: true });

const loadedPosts = computed(() => {
    let list = postsStore.posts;
    if (props.type) {
        list = list.filter(p => p.type === props.type);
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
