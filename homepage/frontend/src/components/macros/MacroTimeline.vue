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
import { useProjectContent } from '../../composables/useProjectContent.js';
import Timeline from '../common/Timeline.vue';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Zeitstrahl' },
    subtitle: { type: String }
});

const timelineItems = useProjectContent(() => props.project, 'timeline');
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
