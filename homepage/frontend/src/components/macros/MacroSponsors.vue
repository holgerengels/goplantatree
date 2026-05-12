<template>
  <section class="macro-sponsors" v-if="sponsors.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
    </div>
    <div class="sponsors-grid">
      <a
        v-for="sponsor in sponsors"
        :key="sponsor.name"
        :href="sponsor.url"
        target="_blank"
        rel="noopener"
        class="sponsor-card card"
      >
        <img v-if="sponsor.logo && sponsor.logo.url" :src="sponsor.logo.url" :alt="sponsor.name" class="sponsor-logo" />
        <span v-else class="sponsor-name">{{ sponsor.name }}</span>
      </a>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Partner & Sponsoren' }
});

const sponsors = ref([]);

watch(() => props.project, async (newVal) => {
    if (!newVal) return;
    try {
        const project = await api.get(`/projects/${newVal}`);
        sponsors.value = project?.content?.sponsors || [];
    } catch { /* empty */ }
}, { immediate: true });
</script>

<style scoped>
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.sponsors-grid {
    display: flex; flex-wrap: wrap; gap: var(--space-lg); justify-content: center;
}
.sponsor-card {
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-lg) var(--space-xl) !important;
    text-decoration: none; min-width: 200px;
    min-height: 120px;
}
.sponsor-name { font-weight: 600; color: var(--color-primary); }
.sponsor-logo {
    max-width: 160px;
    max-height: 80px;
    object-fit: contain;
}
</style>
