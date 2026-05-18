<template>
  <figure class="macro-media" :class="[`align-${align}`]" v-if="media">
    <video v-if="media.mimeType?.startsWith('video/')" :src="media.url || `/api/v1/media/${media._id}/file`" controls :autoplay="autoplay" :loop="loop" :muted="muted" playsinline></video>
    <img v-else :src="media.url || `/api/v1/media/${media._id}/file`" :alt="media.title || media.filename" />
    <figcaption v-if="showCaption && (media.title || media.author)" class="media-caption" v-html="captionHtml"></figcaption>
  </figure>
  <div v-else-if="error" class="macro-media-error">
    Media not found (ID: {{ id }})
  </div>
  <div v-else class="macro-media-loading">
    Lade Bild...
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { buildCaption } from '../../utils/media.js';
import { api } from '../../services/api.js';

const props = defineProps({
    id: {
        type: String,
        required: true
    },
    align: {
        type: String,
        default: 'center' // left, right, center
    },
    showCaption: {
        type: Boolean,
        default: true
    },
    autoplay: Boolean,
    loop: Boolean,
    muted: Boolean
});

const media = ref(null);
const error = ref(false);

const captionHtml = computed(() => {
    return media.value ? buildCaption(media.value) : '';
});

onMounted(async () => {
    if (!props.id) return;
    try {
        media.value = await api.get(`/media/${props.id}/info`);
    } catch (err) {
        console.error('Failed to load macro media:', err);
        error.value = true;
    }
});
</script>

<style scoped>
.macro-media {
    margin: var(--space-xl) 0;
    width: 100%;
}

.macro-media.align-center {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.macro-media.align-left {
    float: left;
    margin-right: var(--space-lg);
    margin-bottom: var(--space-md);
    max-width: 50%;
}

.macro-media.align-right {
    float: right;
    margin-left: var(--space-lg);
    margin-bottom: var(--space-md);
    max-width: 50%;
}

.macro-media img, .macro-media video {
    max-width: 100%;
    border-radius: var(--radius-md);
    display: block;
}

.media-caption {
    margin-top: var(--space-sm);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: right;
    width: 100%;
}

.macro-media-error {
    background: rgba(255, 0, 0, 0.1);
    color: var(--color-error);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
}

.macro-media-loading {
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    background: var(--color-bg-alt);
    border-radius: var(--radius-md);
}
</style>
