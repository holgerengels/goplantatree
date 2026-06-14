<template>
  <div class="dynamic-form">
    <div class="dynamic-form-grid" :style="gridStyle">
      <div v-for="field in orderedFields" :key="field.name" class="form-field-wrapper" :style="getFieldStyle(field)">
        <FormField
          v-if="field.visible !== false"
          :field="field"
          :context="modelValue"
          :modelValue="getNestedValue(modelValue, field.name)"
          :useWebAwesome="useWebAwesome"
          @update:modelValue="updateField(field.name, $event)"
          @select="handleCopyFrom"
        />
      </div>
    </div>

    <div v-if="errors.length > 0" ref="errorBox" class="error-messages">
      <div v-for="(error, index) in errors" :key="index" class="error-item">
        ⚠ {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, defineExpose, computed, watch, ref, nextTick } from 'vue';
import FormField from './FormField.vue';
import { evaluateFields, validateFields, applyPermissionsToFields } from '../../utils/evaluation.js';
import { useAuthStore } from '../../stores/auth.js';

const props = defineProps({
    fields: { type: Array, required: true },
    modelValue: { type: Object, required: true },
    grid: { type: Array, default: () => [] },
    useWebAwesome: { type: Boolean, default: false },
    resource: { type: String, default: '' },
    action: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

const auth = useAuthStore();

const errors = ref([]);
const errorBox = ref(null);
const isNarrow = ref(false);

// Responsive: check window width
const checkWidth = () => { isNarrow.value = window.innerWidth < 768; };
checkWidth();
if (typeof window !== 'undefined') {
    window.addEventListener('resize', checkWidth);
}

const getNestedValue = (obj, path) => {
    return path.split('.').reduce((o, i) => o ? o[i] : undefined, obj);
};

const updateField = (name, value) => {
    const parts = name.split('.');
    let curr = props.modelValue;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
    emit('update:modelValue', props.modelValue);
};

const handleCopyFrom = ({ field, item }) => {
    if (!field.copyFrom || !item) return;
    for (const [sourceKey, targetKey] of Object.entries(field.copyFrom)) {
        const val = item[sourceKey];
        if (val !== undefined && val !== null && val !== '') {
            // Only copy if the target field is empty
            const current = getNestedValue(props.modelValue, targetKey);
            if (!current && current !== 0 && current !== false) {
                updateField(targetKey, val);
            }
        }
    }
};

// Auto re-validate if errors are showing
watch(() => props.modelValue, () => {
    if (errors.value.length > 0) validate();
}, { deep: true });

const validate = () => {
    const result = validateFields(
        props.modelValue,
        props.fields,
        props.resource && props.action && auth.isAuthenticated ? auth.user : null,
        props.resource,
        props.action
    );
    errors.value = result.errors;
    if (!result.isValid) {
        nextTick(() => {
            errorBox.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }
    return result.isValid;
};

defineExpose({ validate, errors });

// Grid logic
const evaluatedFields = computed(() => {
    let fields = evaluateFields(props.fields, props.modelValue);
    if (props.resource && props.action && auth.isAuthenticated) {
        fields = applyPermissionsToFields(fields, auth.user, props.resource, props.action, props.modelValue);
    }
    return fields;
});

const visibleFields = computed(() => evaluatedFields.value.filter(f => f.visible !== false));

const orderedFields = computed(() => {
    const visible = visibleFields.value;
    if (isNarrow.value || !props.grid || props.grid.length === 0) return visible;

    const gridOrder = [];
    const seen = new Set();
    props.grid.forEach(row => {
        row.split(/\s+/).forEach(token => {
            if (token !== '.' && !seen.has(token)) {
                seen.add(token);
                gridOrder.push(token);
            }
        });
    });

    const fieldMap = new Map(visible.map(f => [f.name, f]));
    const result = [];
    gridOrder.forEach(name => {
        if (fieldMap.has(name)) {
            result.push(fieldMap.get(name));
            fieldMap.delete(name);
        }
    });
    visible.forEach(f => { if (fieldMap.has(f.name)) result.push(f); });
    return result;
});

const gridStyle = computed(() => {
    if (isNarrow.value || !props.grid || props.grid.length === 0) return {};
    
    const visibleNames = new Set(visibleFields.value.map(f => f.name));
    const allFieldNames = new Set(props.fields.map(f => f.name));
    
    let areas = props.grid.filter(rowStr => {
        const tokens = rowStr.split(/\s+/);
        const fieldsInRow = tokens.filter(token => allFieldNames.has(token));
        if (fieldsInRow.length > 0) {
            return fieldsInRow.some(name => visibleNames.has(name));
        }
        return true;
    });
    
    const allGridTokens = new Set(props.grid.join(' ').split(/\s+/));
    const missingFields = visibleFields.value.filter(f => !allGridTokens.has(f.name));
    missingFields.forEach(f => {
        areas.push(`${f.name} ${f.name} ${f.name} ${f.name}`);
    });
    const safeAreas = areas.map(row => {
        return row.split(/\s+/).map(token => {
            if (token === '.') return '.';
            return token.replace(/\./g, '_');
        }).join(' ');
    });
    
    return {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gridTemplateRows: 'auto',
        gridTemplateAreas: safeAreas.map(row => `"${row}"`).join(' '),
        gap: '1rem'
    };
});

const getFieldStyle = (field) => {
    if (isNarrow.value || !props.grid || props.grid.length === 0) return {};
    return { gridArea: field.name.replace(/\./g, '_') };
};
</script>

<style scoped>
.dynamic-form {
    display: flex;
    flex-direction: column;
}

.error-messages {
    background: rgba(229, 57, 53, 0.08);
    border: 1px solid rgba(229, 57, 53, 0.3);
    color: var(--color-error, #E53935);
    padding: var(--space-md, 1rem);
    border-radius: var(--radius-md, 10px);
    margin-top: var(--space-md, 1rem);
}

.error-item {
    margin-bottom: var(--space-xs, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
}
.error-item:last-child {
    margin-bottom: 0;
}
</style>
