<template>
  <section class="macro-timeline" v-if="timelineItems.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <Timeline :items="timelineItems" />
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { api } from '../../services/api.js';
import Timeline from '../common/Timeline.vue';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Zeitstrahl' },
    subtitle: { type: String, default: 'Von der Bestellung bis zur Ausgabe' }
});

const timelineItems = ref([]);

watch(() => props.project, async (newVal) => {
    if (!newVal) return;
    try {
        const project = await api.get(`/projects/${newVal}`);
        timelineItems.value = project?.content?.timeline || [];
    } catch { /* empty */ }
}, { immediate: true });
</script>

<style scoped>
.macro-timeline {
    max-width: 800px;
    margin: 0 auto;
}
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.section-title h2 { margin-bottom: var(--space-xs); }
.section-title p { color: var(--color-text-muted); }
</style>
