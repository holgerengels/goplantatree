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
        <img v-if="sponsor.logo && sponsor.logo.url" :src="sponsor.logo.url + '?v=thumb'" :alt="sponsor.name" class="sponsor-logo" />
        <span class="sponsor-name">{{ sponsor.name }}</span>
      </a>
    </div>
  </section>
</template>

<script setup>
import { useProjectContent } from '../../composables/useProjectContent.js';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Partner & Sponsoren' }
});

const sponsors = useProjectContent(() => props.project, 'sponsors');
</script>

<style scoped>
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.sponsors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-lg);
    justify-items: stretch;
}
.sponsor-card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--space-lg) var(--space-xl) !important;
    text-decoration: none;
    min-height: 120px;
    text-align: center;
    gap: var(--space-sm);
}
.sponsor-name { font-weight: 600; color: var(--color-primary); font-size: var(--text-sm); }
.sponsor-logo {
    max-width: 160px;
    max-height: 80px;
    object-fit: contain;
}
</style>
