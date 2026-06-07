<template>
  <wa-select
    :label="field.label"
    :required="field.required === true"
    :disabled="field.readonly === true || loading ? true : undefined"
    :value="normalizedValue"
    :multiple="field.multiple === true"
    :help-text="field.hint"
    @change="updateValue($event.target.value)"
  >
    <wa-option v-if="!field.multiple" value="" disabled>{{ loading ? 'Wird geladen…' : 'Bitte wählen …' }}</wa-option>
    <wa-option v-for="opt in options" :key="getOptValue(opt)" :value="getOptValue(opt)">
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

// Which field to use as value: 'slug' for soft refs, '_id' for ObjectId refs
const valueField = computed(() => props.field.valueField || '_id');

const updateValue = (val) => {
    emit('update:modelValue', val);
};

const getOptValue = (opt) => {
    return opt[valueField.value] || opt._id;
};

const normalizedValue = computed(() => {
    if (props.field.multiple === true) {
        if (!props.modelValue) return [];
        if (Array.isArray(props.modelValue)) {
            return props.modelValue.map(item => {
                if (item && typeof item === 'object') {
                    return item[valueField.value] || item._id;
                }
                return item;
            });
        }
        if (typeof props.modelValue === 'object' && props.modelValue !== null) {
            return [props.modelValue[valueField.value] || props.modelValue._id];
        }
        return [props.modelValue];
    }
    if (props.modelValue && typeof props.modelValue === 'object' && props.modelValue !== null) {
        return props.modelValue[valueField.value] || props.modelValue._id;
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
