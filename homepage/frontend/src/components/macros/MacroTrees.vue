<template>
  <div class="macro-trees">
    <!-- Filter bar -->
    <div class="tree-filter" v-if="filterOptions.length">
      <button
        :class="['btn', !activeCategory && !activeSizeCategory && !activeProperty ? 'btn-primary' : 'btn-secondary']"
        @click="clearFilters"
      >
        Alle ({{ trees.length }})
      </button>
      <button
        v-for="opt in filterOptions"
        :key="opt.value"
        :class="['btn', activeCategory === opt.value ? 'btn-primary' : 'btn-secondary']"
        @click="setCategory(opt.value)"
      >
        {{ opt.label }} ({{ countByCategory(opt.value) }})
      </button>
    </div>

    <!-- Active generic filters -->
    <div class="active-filters" v-if="activeSizeCategory || activeProperty">
      <span class="filter-badge" v-if="activeSizeCategory">
        Größe: {{ activeSizeCategory }}
        <button class="remove-filter" @click="activeSizeCategory = ''">×</button>
      </span>
      <span class="filter-badge" v-if="activeProperty">
        Eigenschaft: {{ activeProperty }}
        <button class="remove-filter" @click="activeProperty = ''">×</button>
      </span>
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
          <div class="tree-card-specs" v-if="tree.height || tree.width || tree.growthForm">
            <span class="size-specs">
              <span v-if="tree.height">↕ {{ tree.height }}</span><span v-if="tree.height && tree.width">, </span><span v-if="tree.width">↔ {{ tree.width }}</span><span v-if="(tree.height || tree.width) && tree.growthForm">, </span><span v-if="tree.growthForm">{{ tree.growthForm }}</span>
            </span>
          </div>
          <div class="tree-card-tags" v-if="tree.properties?.length">
            <span v-for="tag in tree.properties" :key="tag" class="tree-tag">{{ tag }}</span>
          </div>
          <p v-if="tree.summary" class="tree-card-summary">{{ tree.summary }}</p>
        </div>
      </router-link>
    </div>

    <div v-else-if="loading" class="loading-trees">Wird geladen …</div>
    <div v-else class="no-trees">Keine Baumsteckbriefe gefunden.</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../services/api.js';
import { getCategoryGradient } from '../../utils/gradients.js';
import { mediaUrl } from '../../utils/media.js';

const props = defineProps({
    category: { type: String, default: '' },
    limit: { type: Number, default: 0 }
});

const trees = ref([]);
const loading = ref(true);
const route = useRoute();
const router = useRouter();

const activeCategory = ref(props.category || route.query.category || '');
const activeSizeCategory = ref(route.query.sizeCategory || '');
const activeProperty = ref(route.query.property || '');

watch(() => props.category, (newVal) => {
    activeCategory.value = newVal || '';
});

// Sync query params when route changes
watch(() => route.query, (newQuery) => {
    if (newQuery.category) activeCategory.value = newQuery.category;
    if (newQuery.sizeCategory) activeSizeCategory.value = newQuery.sizeCategory;
    if (newQuery.property) activeProperty.value = newQuery.property;
}, { deep: true });

const clearFilters = () => {
    activeCategory.value = '';
    activeSizeCategory.value = '';
    activeProperty.value = '';
    router.replace({ query: {} });
};

const setCategory = (cat) => {
    activeCategory.value = cat;
    // Keep other query params but update category? Or clear others?
    // Let's just update local state and let the query param stay as is or be cleared
};

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
    if (activeSizeCategory.value) {
        list = list.filter(t => t.sizeCategory === activeSizeCategory.value);
    }
    if (activeProperty.value) {
        const queryProp = activeProperty.value.toLowerCase();
        list = list.filter(t => Array.isArray(t.properties) && t.properties.some(p => p.toLowerCase().includes(queryProp)));
    }
    if (props.limit > 0) return list.slice(0, props.limit);
    return list;
});

const countByCategory = (cat) => trees.value.filter(t => t.category === cat).length;

const cardImageStyle = (tree) => {
    const url = mediaUrl(tree.image, 'small');
    if (url) {
        return { backgroundImage: `url(${url})` };
    }
    return { background: getCategoryGradient(tree.category) };
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
    margin-bottom: var(--space-md);
}

.active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    justify-content: center;
    margin-bottom: var(--space-2xl);
}

.filter-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-50);
    color: var(--color-primary-dark);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: 500;
}

.remove-filter {
    background: transparent;
    border: none;
    font-size: 18px;
    line-height: 1;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0 4px;
}
.remove-filter:hover {
    color: var(--color-error);
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

.tree-card-image .badge {
    background: var(--color-surface);
    color: var(--color-primary-dark);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
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
    margin-bottom: var(--space-xs);
}

.size-specs {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
}

.tree-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: var(--space-xs);
}

.tree-tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    background: var(--color-primary-50, rgba(46, 86, 65, 0.1));
    color: var(--color-primary-dark);
    font-size: var(--text-xs);
    font-weight: 500;
}

.tree-card-summary {
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
