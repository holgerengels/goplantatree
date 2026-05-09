<template>
  <section class="macro-offerings" v-if="offerings.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
      <p>{{ offerings.length }} Baumarten stehen zur Auswahl</p>
    </div>
    <div class="offerings-grid">
      <div v-for="offering in offerings" :key="offering._id" class="offering-card card">
        <div class="offering-image" :style="imageStyle(offering)">
          <span class="badge badge-accent">{{ offering.category }}</span>
          <span v-if="!offering.available" class="badge badge-warning offering-unavailable">Vergriffen</span>
        </div>
        <div class="offering-body">
          <h3>{{ offering.name }}</h3>
          <div class="offering-meta" v-if="offering.tree">
            <router-link :to="`/baeume/${offering.tree._id}`" class="tree-link">
              📖 Baumsteckbrief →
            </router-link>
          </div>
        </div>
      </div>
    </div>
    <div class="section-more" v-if="projectSlug">
      <router-link :to="`/bestellen/${projectSlug}`" class="btn btn-accent btn-lg">
        🌳 Jetzt bestellen
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Verfügbare Bäume' }
});

const offerings = ref([]);
const projectSlug = ref('');

const imageStyle = (offering) => {
    if (offering.image?.url) return { backgroundImage: `url(${offering.image.url})` };
    const gradients = {
        'Laubbaum': 'linear-gradient(135deg, #4CAF50, #81C784)',
        'Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
        'Halbstamm-Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
        'Hochstamm-Obstbaum': 'linear-gradient(135deg, #8D6E63, #BCAAA4)'
    };
    return { background: gradients[offering.category] || 'linear-gradient(135deg, #2E5641, #A3DE74)' };
};

watch(() => props.project, async (newVal) => {
    if (!newVal) return;
    projectSlug.value = newVal;
    try {
        const res = await fetch(`/api/v1/offerings?project=${newVal}&available=true`);
        if (res.ok) offerings.value = await res.json();
    } catch { /* empty */ }
}, { immediate: true });
</script>

<style scoped>
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.section-title p { color: var(--color-text-muted); }
.offerings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-xl);
}
.offering-card { overflow: hidden; padding: 0 !important; }
.offering-image {
    height: 160px; background-size: cover; background-position: center;
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: var(--space-sm);
}
.offering-unavailable { margin-left: auto; }
.offering-body { padding: var(--space-lg); }
.offering-body h3 { font-size: var(--text-lg); margin-bottom: var(--space-sm); color: var(--color-primary-dark); }
.offering-meta { margin-top: var(--space-xs); }
.tree-link { font-size: var(--text-xs); color: var(--color-primary); }
.tree-link:hover { color: var(--color-accent-dark); }
.section-more { text-align: center; margin-top: var(--space-2xl); }
</style>
