<template>
  <div class="macro-trees">
    <!-- Filter bar -->
    <div class="tree-filter" v-if="filterOptions.length">
      <button
        :class="['btn', !activeCategory ? 'btn-primary' : 'btn-secondary']"
        @click="activeCategory = ''"
      >
        Alle ({{ trees.length }})
      </button>
      <button
        v-for="opt in filterOptions"
        :key="opt.value"
        :class="['btn', activeCategory === opt.value ? 'btn-primary' : 'btn-secondary']"
        @click="activeCategory = opt.value"
      >
        {{ opt.label }} ({{ countByCategory(opt.value) }})
      </button>
    </div>

    <!-- Card grid -->
    <div class="tree-grid" v-if="filteredTrees.length">
      <router-link
        v-for="tree in filteredTrees"
        :key="tree._id"
        :to="`/baeume/${tree.slug || tree._id}`"
        class="tree-card card"
      >
        <div class="tree-card-image" :style="cardImageStyle(tree)">
          <span class="badge badge-accent" v-if="tree.category">{{ tree.category }}</span>
        </div>
        <div class="tree-card-body">
          <h3>{{ tree.name }}</h3>
          <div class="tree-card-specs" v-if="tree.height || tree.width">
            <span v-if="tree.height" class="spec">📏 {{ tree.height }}</span>
            <span v-if="tree.width" class="spec">↔️ {{ tree.width }}</span>
          </div>
          <p v-if="tree.notice" class="tree-card-notice">{{ tree.notice }}</p>
        </div>
      </router-link>
    </div>

    <div v-else-if="loading" class="loading-trees">Wird geladen …</div>
    <div v-else class="no-trees">Keine Baumsteckbriefe gefunden.</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    category: { type: String, default: '' },
    limit: { type: Number, default: 0 }
});

const trees = ref([]);
const loading = ref(true);
const activeCategory = ref(props.category || '');

watch(() => props.category, (newVal) => {
    activeCategory.value = newVal || '';
});

const filterOptions = [
    { value: 'Laubbaum', label: '🌳 Laubbäume' },
    { value: 'Obstbaum', label: '🍎 Obstbäume' },
    { value: 'Nadelbaum', label: '🌲 Nadelbäume' },
    { value: 'Großstrauch', label: '🌿 Großsträucher' },
    { value: 'Strauch', label: '🌿 Sträucher' }
];

const filteredTrees = computed(() => {
    let list = trees.value;
    if (activeCategory.value) {
        list = list.filter(t => t.category === activeCategory.value);
    }
    if (props.limit > 0) return list.slice(0, props.limit);
    return list;
});

const countByCategory = (cat) => trees.value.filter(t => t.category === cat).length;

const cardImageStyle = (tree) => {
    if (tree.image && typeof tree.image === 'object' && tree.image.url) {
        return { backgroundImage: `url(${tree.image.url})` };
    }
    const gradients = {
        'Laubbaum': 'linear-gradient(135deg, #4CAF50, #81C784)',
        'Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
        'Nadelbaum': 'linear-gradient(135deg, #558B2F, #8BC34A)',
        'Großstrauch': 'linear-gradient(135deg, #26A69A, #80CBC4)',
        'Strauch': 'linear-gradient(135deg, #66BB6A, #A5D6A7)'
    };
    return { background: gradients[tree.category] || 'linear-gradient(135deg, #2E5641, #A3DE74)' };
};

onMounted(async () => {
    try {
        trees.value = await api.get('/trees');
    } catch { /* fallback empty */ }
    loading.value = false;
});
</script>

<style scoped>
.tree-filter {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    justify-content: center;
    margin-bottom: var(--space-2xl);
}

.tree-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-xl);
}

.tree-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    overflow: hidden;
    padding: 0 !important;
}
.tree-card:hover {
    transform: translateY(-4px);
}

.tree-card-image {
    height: 180px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-start;
    padding: var(--space-sm);
}

.tree-card-body {
    padding: var(--space-lg);
    flex: 1;
}

.tree-card-body h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-sm);
    color: var(--color-primary-dark);
}

.tree-card-specs {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-xs);
}

.spec {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
}

.tree-card-notice {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin: 0;
}

.loading-trees, .no-trees {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--space-xl);
}
</style>
