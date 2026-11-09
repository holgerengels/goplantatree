<template>
  <router-link :to="postUrl" class="post-card card">
    <div class="post-image" :style="imageStyle"></div>
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
import { mediaUrl } from '../../utils/media.js';

const props = defineProps({
    post: { type: Object, required: true }
});

const postUrl = computed(() => {
    const slug = props.post?.slug || props.post?._id;
    return props.post?.type === 'pflanzung' ? `/pflanzblog/${slug}` : `/blog/${slug}`;
});

const imageStyle = computed(() => {
    const url = mediaUrl(props.post.image, 'small');
    if (url) {
        return { backgroundImage: `url(${url})` };
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
