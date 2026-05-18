<template>
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
      {{ getLabel(opt) }}
    </wa-option>
  </wa-select>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    field: { type: Object, required: true },
    modelValue: { required: false }
});

const emit = defineEmits(['update:modelValue']);

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

const getLabel = (opt) => {
    const labelField = props.field.labelField || 'name';
    let label = opt[labelField] || opt.title || opt._id;
    if (opt.category) {
        label += ` (${opt.category})`;
    }
    return label;
};

const loadData = async () => {
    if (!props.field.reference) return;
    loading.value = true;
    try {
        const data = await api.get(props.field.reference);
        options.value = Array.isArray(data) ? data : (data.items || Object.values(data).find(v => Array.isArray(v)) || []);
    } catch (err) {
        console.error('Failed to load relation data for', props.field.name, err);
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);
</script>
