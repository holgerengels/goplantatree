<template>
  <div class="form-field-content">
    <!-- Date -->
    <div v-if="field.type === 'Date'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <input
        type="date"
        class="form-input"
        :required="field.required === true"
        :disabled="field.readonly === true"
        :value="formatDateForInput(modelValue)"
        @change="updateValue($event.target.value)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Time -->
    <div v-else-if="field.type === 'Time'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <input
        type="time"
        class="form-input"
        :required="field.required === true"
        :disabled="field.readonly === true"
        :value="modelValue || ''"
        @change="updateValue($event.target.value)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Select -->
    <div v-else-if="field.type === 'Select'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <select
        class="form-select"
        :required="field.required === true"
        :disabled="field.readonly === true"
        :value="normalizedSelectValue"
        @change="updateValue($event.target.value)"
      >
        <option value="" disabled>Bitte wählen …</option>
        <option v-for="opt in resolvedOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <!-- Offering notice -->
      <div v-if="selectedOffering?.notice" class="offering-notice">
        ⚠️ {{ selectedOffering.notice }}
      </div>
      <!-- Offering addons -->
      <div v-if="selectedOffering?.addons?.length" class="offering-addons">
        <p class="addons-title">Zusatzoptionen:</p>
        <label v-for="addon in selectedOffering.addons" :key="addon.name" class="form-checkbox addon-checkbox">
          <input
            type="checkbox"
            :checked="isAddonSelected(addon.name)"
            @change="toggleAddon(addon.name, $event.target.checked)"
          />
          <span>{{ addon.name }}</span>
          <span v-if="addon.description" class="addon-desc">– {{ addon.description }}</span>
        </label>
      </div>
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Boolean / Checkbox -->
    <div v-else-if="field.type === 'Boolean'" class="form-group">
      <label class="form-checkbox">
        <input
          type="checkbox"
          :checked="modelValue === true"
          :disabled="field.readonly === true"
          :required="field.required === true"
          @change="updateValue($event.target.checked)"
        />
        <span>{{ field.label }}</span>
      </label>
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Integer -->
    <div v-else-if="field.type === 'Integer'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <input
        type="number"
        step="1"
        min="1"
        class="form-input"
        :required="field.required === true"
        :disabled="field.readonly === true"
        :value="modelValue || ''"
        @change="updateValue(parseInt($event.target.value) || '')"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- RichText -->
    <div v-else-if="field.type === 'RichText'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <RichTextEditor
        :modelValue="modelValue || ''"
        :disabled="field.readonly === true"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- HTML Source Editor -->
    <div v-else-if="field.type === 'Html'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <HtmlEditor
        :modelValue="modelValue || ''"
        :disabled="field.readonly === true"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Object Array (Recursive nested form fields) -->
    <div v-else-if="field.type === 'ObjectArray'" class="form-group object-array-container">
      <label class="form-label">{{ field.label }}</label>
      <p v-if="field.description" class="form-hint" style="margin-bottom: var(--space-sm);">{{ field.description }}</p>
      
      <div class="object-array">
      <div v-for="(item, index) in (modelValue || [])" :key="index" class="object-array-item card">
        <div class="object-array-header">
          <span class="object-array-title">Eintrag {{ index + 1 }}</span>
          <button type="button" @click="removeArrayItem(index)" class="btn btn-sm btn-outline btn-warning">Entfernen</button>
        </div>
        <div class="object-array-fields">
          <FormField
            v-for="subField in field.itemFields"
            :key="subField.name"
            :field="subField"
            :context="item"
            :modelValue="item[subField.name]"
            @update:modelValue="updateArrayItemField(index, subField.name, $event)"
          />
        </div>
      </div>
      </div>
      <button type="button" @click="addArrayItem" class="btn btn-secondary btn-sm" style="margin-top: var(--space-sm);">
        + Neuer Eintrag
      </button>
      <span v-if="field.hint" class="form-hint" style="display:block; margin-top:var(--space-sm);">{{ field.hint }}</span>
    </div>

    <!-- Media Selector -->
    <div v-else-if="field.type === 'Media'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <MediaSelector
        :modelValue="modelValue || ''"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- File (for direct uploads) -->
    <div v-else-if="field.type === 'File'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <input
        type="file"
        class="form-input"
        :required="field.required === true"
        :disabled="field.readonly === true"
        @change="updateValue($event.target.files[0])"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- ImagePreview -->
    <div v-else-if="field.type === 'ImagePreview'" class="form-group">
      <label class="form-label">{{ field.label }}</label>
      <div v-if="context && context.url" class="image-preview-wrapper">
        <video v-if="context.mimeType?.startsWith('video/')" :src="context.url" controls class="form-preview-media"></video>
        <img v-else :src="context.url" class="form-preview-media" />
      </div>
      <p v-else class="form-hint">Keine Vorschau verfügbar.</p>
    </div>

    <!-- Default: Text -->
    <div v-else class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <input
        type="text"
        class="form-input"
        :required="field.required === true"
        :disabled="field.readonly === true"
        :value="modelValue || ''"
        :placeholder="field.placeholder || ''"
        @input="updateValue($event.target.value)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed, watch, inject } from 'vue';
import RichTextEditor from './RichTextEditor.vue';
import HtmlEditor from './HtmlEditor.vue';
import MediaSelector from './MediaSelector.vue';

const props = defineProps({
    field: { type: Object, required: true },
    context: { type: Object, default: () => ({}) },
    modelValue: { required: true },
    useWebAwesome: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const updateValue = (val) => {
    emit('update:modelValue', val);
};

// For Select fields: if modelValue is a populated object (e.g. {_id, name}), extract _id
const normalizedSelectValue = computed(() => {
    if (props.modelValue && typeof props.modelValue === 'object' && props.modelValue._id) {
        return props.modelValue._id;
    }
    return props.modelValue || '';
});

const formatDateForInput = (val) => {
    if (!val) return '';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return d.toISOString().split('T')[0];
    } catch {
        return val;
    }
};

// Resolve dynamic options (e.g., "dynamic:offerings" loads from injected data)
const dynamicSources = {
    offerings: inject('dynamicOfferings', null),
    trees: inject('dynamicTrees', null),
    projects: inject('dynamicProjects', null),
    profiles: inject('dynamicProfiles', null)
};

const resolvedOptions = computed(() => {
    if (!props.field.options) return [];
    
    // Dynamic options: "dynamic:offerings" → load from injected source
    if (typeof props.field.options === 'string' && props.field.options.startsWith('dynamic:')) {
        const sourceKey = props.field.options.replace('dynamic:', '');
        const source = dynamicSources[sourceKey];
        if (source && source.value) {
            return source.value.map(item => ({
                value: item._id,
                label: item.name + (item.category ? ` (${item.category})` : '')
            }));
        }
        return [];
    }
    
    // Static options
    return props.field.options.map(opt => {
        if (typeof opt === 'string') return { value: opt, label: opt };
        return opt;
    });
});

// For dynamic:offerings — find the full offering object for the currently selected value
const isDynamicOfferings = computed(() => {
    return typeof props.field.options === 'string' && props.field.options === 'dynamic:offerings';
});

const selectedOffering = computed(() => {
    if (!isDynamicOfferings.value || !props.modelValue) return null;
    const source = dynamicSources.offerings;
    if (!source?.value) return null;
    return source.value.find(item => item._id === props.modelValue) || null;
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
    // Write directly to context (reactive order data)
    props.context.selectedAddons = current;
};
// Clear addon selections when offering changes
watch(() => props.modelValue, () => {
    if (isDynamicOfferings.value && props.context) {
        props.context.selectedAddons = [];
    }
});

// Set default values
watch(() => [props.field.type, props.field.default], ([, newDefault]) => {
    if (props.modelValue === undefined && newDefault !== undefined) {
        updateValue(newDefault);
    } else if (props.field.type === 'ObjectArray' && !props.modelValue) {
        // Initialize empty array for ObjectArray
        updateValue([]);
    }
}, { immediate: true });

// Methods for ObjectArray type
const addArrayItem = () => {
    const arr = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    arr.push({});
    updateValue(arr);
};

const removeArrayItem = (index) => {
    if (!Array.isArray(props.modelValue)) return;
    const arr = [...props.modelValue];
    arr.splice(index, 1);
    updateValue(arr);
};

const updateArrayItemField = (index, fieldName, value) => {
    if (!Array.isArray(props.modelValue)) return;
    const arr = [...props.modelValue];
    if (!arr[index]) arr[index] = {};
    arr[index] = { ...arr[index], [fieldName]: value };
    updateValue(arr);
};
</script>

<style scoped>
.form-textarea {
    resize: vertical;
    min-height: 100px;
}


.object-array-container {
    display: flex;
    flex-direction: column;
}

.object-array {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.object-array-item {
    margin-bottom: var(--space-md);
    padding: var(--space-md) !important;
    background: var(--color-bg);
}

.object-array-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-border);
}

.object-array-title {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--color-primary);
}

.object-array-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.image-preview-wrapper {
    margin-top: var(--space-sm);
    background: var(--color-bg-alt);
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    display: flex;
    justify-content: center;
}

.form-preview-media {
    max-width: 100%;
    max-height: 300px;
    object-fit: contain;
    border-radius: var(--radius-sm);
}

/* Offering notice */
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

/* Offering addons */
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
