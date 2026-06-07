<template>
  <div class="offering-selector">
    <wa-select
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true || loading ? true : undefined"
      :value="normalizedValue"
      :help-text="field.hint"
      @change="updateValue($event.target.value)"
    >
      <wa-option value="" disabled>{{ loading ? 'Wird geladen…' : 'Bitte wählen …' }}</wa-option>
      <wa-option v-for="opt in options" :key="opt.slug || opt._id" :value="opt.slug || opt._id">
        {{ opt.name }}{{ opt.category ? ` (${opt.category})` : '' }}
      </wa-option>
    </wa-select>

    <!-- Selected offering card -->
    <div v-if="selectedOffering" class="selected-card card">
      <div class="selected-card-image" :style="cardImageStyle">
        <div class="badge-group">
          <span class="badge badge-accent">{{ selectedOffering.category }}</span>
          <a
            v-if="selectedOffering.tree"
            :href="`/baeume/${selectedOffering.tree}`"
            class="badge badge-primary tree-link"
            target="_blank"
            title="Steckbrief öffnen"
          >→ Steckbrief</a>
        </div>
        <span v-if="!selectedOffering.available" class="badge badge-warning">Vergriffen</span>
      </div>
      <div class="selected-card-body">
        <h4>{{ selectedOffering.name }}</h4>
        <div class="card-details">
          <div v-if="selectedOffering.pflanzgroesseHoehe || selectedOffering.pflanzgroesseStammumfang" class="detail-row">
            <strong>🌱 Pflanzgröße:&nbsp;</strong>
            <span v-if="selectedOffering.pflanzgroesseHoehe">↕ {{ selectedOffering.pflanzgroesseHoehe }}</span>
            <span v-if="selectedOffering.pflanzgroesseHoehe && selectedOffering.pflanzgroesseStammumfang">, </span>
            <span v-if="selectedOffering.pflanzgroesseStammumfang">◯ {{ selectedOffering.pflanzgroesseStammumfang }}</span>
          </div>
          <div v-if="selectedOffering.endgroesseHoehe || selectedOffering.endgroesseBreite" class="detail-row">
            <strong>🌳 Endgröße:&nbsp;</strong>
            <span v-if="selectedOffering.endgroesseHoehe">↕ {{ selectedOffering.endgroesseHoehe }}</span>
            <span v-if="selectedOffering.endgroesseHoehe && selectedOffering.endgroesseBreite">, </span>
            <span v-if="selectedOffering.endgroesseBreite">↔ {{ selectedOffering.endgroesseBreite }}</span>
          </div>
          <div v-if="selectedOffering.bemerkung" class="detail-row bemerkung">
            🌿 {{ selectedOffering.bemerkung }}
          </div>
        </div>

        <!-- Notice -->
        <div v-if="selectedOffering.notice" class="offering-notice">
          ⚠️ {{ selectedOffering.notice }}
        </div>

        <!-- Addons -->
        <div v-if="selectedOffering.addons?.length" class="offering-addons">
          <p class="addons-title">Zusatzoptionen:</p>
          <div v-for="addon in selectedOffering.addons" :key="addon.name">
            <wa-checkbox
              class="addon-checkbox"
              :checked="isAddonSelected(addon.name)"
              @change="toggleAddon(addon.name, $event.target.checked)"
            >
              <span>{{ addon.name }}</span>
              <span v-if="addon.description" class="addon-desc">– {{ addon.description }}</span>
            </wa-checkbox>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../services/api.js';
import { getCategoryGradient } from '../../utils/gradients.js';
import { mediaUrl } from '../../utils/media.js';

const props = defineProps({
    field: { type: Object, required: true },
    context: { type: Object, default: () => ({}) },
    modelValue: { required: false }
});

const emit = defineEmits(['update:modelValue']);

const options = ref([]);
const treeMap = ref({});
const loading = ref(false);

const updateValue = (val) => {
    emit('update:modelValue', val);
};

const normalizedValue = computed(() => {
    if (props.modelValue && typeof props.modelValue === 'object' && props.modelValue._id) {
        return props.modelValue._id;
    }
    return props.modelValue || '';
});

const selectedOffering = computed(() => {
    if (!props.modelValue) return null;
    return options.value.find(item => item.slug === normalizedValue.value || item._id === normalizedValue.value) || null;
});

const cardImageStyle = computed(() => {
    const o = selectedOffering.value;
    if (!o) return {};
    const url = mediaUrl(o.image) || mediaUrl(treeMap.value[o.tree]?.image);
    if (url) return { backgroundImage: `url(${url})` };
    return { background: getCategoryGradient(o.category) };
});

// Addon management — stores selected addon names in context.selectedAddons
const isAddonSelected = (addonName) => {
    const addons = props.context?.selectedAddons;
    return Array.isArray(addons) && addons.includes(addonName);
};

const toggleAddon = (addonName, checked) => {
    const current = Array.isArray(props.context?.selectedAddons) ? [...props.context.selectedAddons] : [];
    if (checked && !current.includes(addonName)) {
        current.push(addonName);
    } else if (!checked) {
        const idx = current.indexOf(addonName);
        if (idx >= 0) current.splice(idx, 1);
    }
    props.context.selectedAddons = current;
};

// Clear addon selections when offering changes
watch(() => props.modelValue, () => {
    if (props.context) {
        props.context.selectedAddons = [];
    }
});

const loadData = async () => {
    const endpoint = props.field.reference || '/api/v1/offerings';
    loading.value = true;
    try {
        const [data, treeData] = await Promise.all([
            api.get(endpoint),
            api.get('/api/v1/trees')
        ]);
        options.value = Array.isArray(data) ? data : (data.items || Object.values(data).find(v => Array.isArray(v)) || []);
        // Build slug → tree map for image resolution
        const trees = Array.isArray(treeData) ? treeData : (treeData.items || []);
        const map = {};
        for (const t of trees) {
            if (t.slug) map[t.slug] = t;
        }
        treeMap.value = map;
    } catch (err) {
        console.error('Failed to load offerings:', err);
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);
</script>

<style scoped>
.offering-selector {
    display: block;
    margin-bottom: var(--space-md);
}

/* Selected offering card */
.selected-card {
    margin-top: var(--space-md);
    overflow: hidden;
    padding: 0 !important;
    display: flex;
    flex-direction: row;
    animation: fadeSlideIn 0.3s ease;
}

@keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
}

.selected-card-image {
    width: 200px;
    min-height: 160px;
    flex-shrink: 0;
    background-size: cover;
    background-position: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-sm);
}

.badge-group {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
}

.selected-card-image .badge {
    background: var(--color-surface);
    color: var(--color-primary-dark);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
    font-size: var(--text-xs);
}

.tree-link {
    text-decoration: none;
    transition: transform var(--transition-fast);
}
.tree-link:hover {
    transform: translateY(-1px);
}

.selected-card-body {
    padding: var(--space-md) var(--space-lg);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.selected-card-body h4 {
    font-size: var(--text-lg);
    color: var(--color-primary-dark);
    margin: 0;
}

.card-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
}
.detail-row strong {
    color: var(--color-primary-dark);
}
.bemerkung {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-top: 2px;
}

/* Notice */
.offering-notice {
    padding: var(--space-xs) var(--space-sm);
    background: rgba(255, 152, 0, 0.1);
    border: 1px solid rgba(255, 152, 0, 0.35);
    border-radius: var(--radius-md);
    color: #8B6914;
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1.5;
}

/* Addons */
.offering-addons {
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-primary-50, rgba(46, 86, 65, 0.06));
    border: 1px solid rgba(46, 86, 65, 0.15);
    border-radius: var(--radius-md);
}

.addons-title {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-primary);
    margin: 0 0 var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.addon-checkbox {
    display: flex !important;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--text-sm);
    margin-bottom: var(--space-xs);
}
.addon-checkbox:last-child {
    margin-bottom: 0;
}

.addon-desc {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
}

@media (max-width: 600px) {
    .selected-card {
        flex-direction: column;
    }
    .selected-card-image {
        width: 100%;
        min-height: 140px;
    }
}
</style>

