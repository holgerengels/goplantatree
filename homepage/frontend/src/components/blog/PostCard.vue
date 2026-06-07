<template>
  <router-link :to="`/post/${post.slug}`" class="post-card card">
    <div class="post-image" :style="!isVideo ? imageStyle : {}">
      <video v-if="isVideo" :src="post.image.url" class="post-video" muted loop playsinline autoplay></video>
      <span class="post-type badge" :class="post.type === 'pflanzung' ? 'badge-accent' : 'badge-primary'">
        {{ post.type === 'pflanzung' ? '🌱 Pflanzung' : '📰 News' }}
      </span>
    </div>
    <div class="post-body">
      <div class="post-meta">
        <time :datetime="post.publishedAt">{{ formatDate(post.publishedAt) }}</time>
        <span v-if="post.author" class="author">{{ post.author }}</span>
      </div>
      <h3 class="post-title">{{ post.title }}</h3>
      <p v-if="post.excerpt" class="post-excerpt">{{ post.excerpt }}</p>
      <div class="post-tags" v-if="post.tags?.length">
        <span v-for="tag in post.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue';
import { formatDateLong as formatDate } from '../../utils/format.js';

const props = defineProps({
    post: { type: Object, required: true }
});

const isVideo = computed(() => props.post.image && props.post.image.mimeType?.startsWith('video/'));

const imageStyle = computed(() => {
    if (props.post.image && props.post.image.url) {
        return { backgroundImage: `url(${props.post.image.url}?v=small)` };
    }
    return {
        background: props.post.type === 'pflanzung'
            ? 'linear-gradient(135deg, #A3DE74, #4CAF50)'
            : 'linear-gradient(135deg, #2E5641, #637648)'
    };
});
</script>

<style scoped>
.post-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    overflow: hidden;
    padding: 0 !important;
}

.post-image {
    height: 160px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-start;
    padding: var(--space-sm);
    position: relative;
}

.post-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
}

.post-type {
    z-index: 1;
}

.post-body {
    padding: var(--space-lg);
    flex: 1;
    display: flex;
    flex-direction: column;
}

.post-meta {
    display: flex;
    gap: var(--space-md);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-sm);
}

.post-title {
    font-size: var(--text-lg);
    margin-bottom: var(--space-sm);
    color: var(--color-primary-dark);
}

.post-excerpt {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    flex: 1;
}

.post-tags {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
    margin-top: var(--space-sm);
}

.tag {
    font-size: var(--text-xs);
    color: var(--color-olive);
    background: var(--color-primary-50);
    padding: 2px 8px;
    border-radius: var(--radius-full);
}
</style>
