<template>
  <div class="dynamic-select-wrapper">
    <wa-select
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true || loading ? true : undefined"
      :value="normalizedValue"
      :help-text="field.hint"
      @change="updateValue($event.target.value)"
    >
      <wa-option value="" disabled>{{ loading ? 'Wird geladen…' : 'Bitte wählen …' }}</wa-option>
      <wa-option v-for="opt in options" :key="opt._id" :value="opt._id">
        {{ opt.name }}{{ opt.category ? ` (${opt.category})` : '' }}
      </wa-option>
    </wa-select>
    
    <!-- Offering notice -->
    <div v-if="selectedOffering?.notice" class="offering-notice">
      ⚠️ {{ selectedOffering.notice }}
    </div>
    
    <!-- Offering addons -->
    <div v-if="selectedOffering?.addons?.length" class="offering-addons">
      <p class="addons-title">Zusatzoptionen:</p>
      <div v-for="addon in selectedOffering.addons" :key="addon.name" class="addon-checkbox-wrapper">
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
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.js';

const props = defineProps({
    field: { type: Object, required: true },
    context: { type: Object, default: () => ({}) },
    modelValue: { required: false }
});

const emit = defineEmits(['update:modelValue']);
const auth = useAuthStore();

const options = ref([]);
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
    return options.value.find(item => item._id === normalizedValue.value) || null;
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
        const res = await fetch(endpoint, { headers: auth.authHeaders });
        const data = await res.json();
        options.value = Array.isArray(data) ? data : (data.items || Object.values(data).find(v => Array.isArray(v)) || []);
    } catch (err) {
        console.error('Failed to load offerings:', err);
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);
</script>

<style scoped>
.dynamic-select-wrapper {
    display: block;
    margin-bottom: var(--space-md);
}

.offering-notice {
    margin-top: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: rgba(255, 152, 0, 0.1);
    border: 1px solid rgba(255, 152, 0, 0.35);
    border-radius: var(--radius-md);
    color: #8B6914;
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1.5;
}

.offering-addons {
    margin-top: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
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
</style>
