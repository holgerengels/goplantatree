<template>
  <div class="macro-timeline" v-if="timelineItems.length">

    <Timeline :items="timelineItems" />
  </div>
</template>

<script setup>
import { useProjectContent } from '../../composables/useProjectContent.js';
import Timeline from '../common/Timeline.vue';

const props = defineProps({
    project: { type: String, required: true }
});

const timelineItems = useProjectContent(() => props.project, 'timeline');
</script>

<style scoped>
.macro-timeline {
    max-width: 800px;
    margin: 0 auto;
}
</style>
