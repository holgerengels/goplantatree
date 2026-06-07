<template>
  <section class="macro-offerings" v-if="offerings.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
      <p>{{ offerings.length }} Baumarten stehen zur Auswahl</p>
    </div>
    <div class="offerings-grid">
      <div v-for="offering in offerings" :key="offering._id" class="offering-card card">
        <div class="offering-image" :style="imageStyle(offering)">
          <div class="badge-group">
            <span class="badge badge-accent">{{ offering.category }}</span>
            <router-link v-if="offering.tree" :to="`/baeume/${offering.tree}`" class="badge badge-primary tree-badge-link" target="_blank" title="Steckbrief in neuem Tab öffnen">
              → mehr Infos
            </router-link>
          </div>
          <span v-if="!offering.available" class="badge badge-warning offering-unavailable">Vergriffen</span>
        </div>
        <div class="offering-body">
          <h3>{{ offering.name }}</h3>
          <div class="offering-details">
            <div class="detail-row" v-if="offering.pflanzgroesseHoehe || offering.pflanzgroesseStammumfang">
              <strong>🌱 Pflanzgröße:&nbsp;</strong> 
              <span class="size-specs">
                <span v-if="offering.pflanzgroesseHoehe">↕ {{ offering.pflanzgroesseHoehe }}</span><span v-if="offering.pflanzgroesseHoehe && offering.pflanzgroesseStammumfang">, </span><span v-if="offering.pflanzgroesseStammumfang">◯ {{ offering.pflanzgroesseStammumfang }}</span>
              </span>
            </div>
            <div class="detail-row" v-if="offering.endgroesseHoehe || offering.endgroesseBreite">
              <strong>🌳 Endgröße:&nbsp;</strong> 
              <span class="size-specs">
                <span v-if="offering.endgroesseHoehe">↕ {{ offering.endgroesseHoehe }}</span><span v-if="offering.endgroesseHoehe && offering.endgroesseBreite">, </span><span v-if="offering.endgroesseBreite">↔ {{ offering.endgroesseBreite }}</span>
              </span>
            </div>
            <div class="detail-row" v-if="offering.bemerkung">
              <strong>🌿 Verwendung / Sonstiges: </strong>
              <span class="properties-text">{{ offering.bemerkung }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { api } from '../../services/api.js';
import { getCategoryGradient } from '../../utils/gradients.js';
import { mediaUrl } from '../../utils/media.js';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Verfügbare Bäume' }
});

const offerings = ref([]);
const treeMap = ref({});
const projectSlug = ref('');

const imageStyle = (offering) => {
    const url = mediaUrl(offering.image)
        || mediaUrl(treeMap.value[offering.tree]?.image);
    if (url) return { backgroundImage: `url(${url})` };
    return { background: getCategoryGradient(offering.category) };
};

watch(() => props.project, async (newVal) => {
    if (!newVal) return;
    projectSlug.value = newVal;
    try {
        const [offerData, treeData] = await Promise.all([
            api.get(`/offerings?project=${newVal}&available=true`),
            api.get('/trees')
        ]);
        offerings.value = offerData;
        // Build slug → tree map for image resolution
        const map = {};
        for (const t of (Array.isArray(treeData) ? treeData : treeData.items || [])) {
            if (t.slug) map[t.slug] = t;
        }
        treeMap.value = map;
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
.offering-card { overflow: hidden; padding: 0 !important; display: flex; flex-direction: column; }
.offering-image {
    height: 200px; background-size: cover; background-position: center;
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: var(--space-sm);
}

.offering-image .badge {
    background: var(--color-surface);
    color: var(--color-primary-dark);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
}

.badge-group {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
}

.tree-badge-link {
    text-decoration: none;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.tree-badge-link:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.offering-unavailable { margin-left: auto; }
.offering-body { padding: var(--space-lg); display: flex; flex-direction: column; }
.offering-body h3 { font-size: var(--text-lg); margin-bottom: var(--space-sm); color: var(--color-primary-dark); }
.offering-details { display: flex; flex-direction: column; gap: var(--space-xs); font-size: var(--text-sm); color: var(--color-text-secondary); }
.detail-row { line-height: 1.4; }
.detail-row strong { color: var(--color-primary-dark); }
.properties-text { margin-top: var(--space-xs); font-size: var(--text-xs); color: var(--color-text-muted); }
.size-specs { color: var(--color-text-muted); font-size: var(--text-xs); margin-left: 4px; }
.section-more { text-align: center; margin-top: var(--space-2xl); }
</style>
