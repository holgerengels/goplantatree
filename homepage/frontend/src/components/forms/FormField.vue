<template>
  <div class="form-field-content" v-if="field">
    <!-- Date -->
    <wa-input
      v-if="field.type === 'Date'"
      type="date"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="formatDateForInput(modelValue)"
      :help-text="field.hint"
      @change="updateValue($event.target.value)"
    ></wa-input>

    <!-- Time -->
    <wa-input
      v-else-if="field.type === 'Time'"
      type="time"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="modelValue || ''"
      :help-text="field.hint"
      @change="updateValue($event.target.value)"
    ></wa-input>

    <!-- Select -->
    <wa-select
      v-else-if="field.type === 'Select'"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="normalizedSelectValue"
      :help-text="field.hint"
      @change="updateValue($event.target.value)"
    >
      <wa-option value="" disabled>Bitte wählen …</wa-option>
      <wa-option v-for="opt in resolvedOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </wa-option>
    </wa-select>

    <!-- Relation -->
    <RelationSelector
      v-else-if="field.type === 'Relation'"
      :field="field"
      :modelValue="modelValue"
      @update:modelValue="updateValue"
      @select="$emit('select', { field: field, item: $event })"
    />

    <!-- OfferingSelector -->
    <OfferingSelector
      v-else-if="field.type === 'OfferingSelector'"
      :field="field"
      :context="context"
      :modelValue="modelValue"
      @update:modelValue="updateValue"
    />

    <!-- Boolean / Checkbox -->
    <wa-checkbox
      v-else-if="field.type === 'Boolean'"
      :checked="modelValue === true"
      :disabled="field.readonly === true ? true : undefined"
      :required="field.required === true"
      :help-text="field.hint"
      @change="updateValue($event.target.checked)"
    >
      <span>{{ field.label }}</span>
    </wa-checkbox>

    <!-- Integer -->
    <wa-input
      v-else-if="field.type === 'Integer'"
      type="number"
      step="1"
      min="1"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="modelValue || ''"
      :help-text="field.hint"
      @change="updateValue(parseInt($event.target.value) || '')"
    ></wa-input>

    <!-- Currency (saved as cents, displayed as decimal Euros) -->
    <wa-input
      v-else-if="field.type === 'Currency'"
      type="number"
      step="0.01"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="modelValue ? (modelValue / 100).toFixed(2) : ''"
      :help-text="field.hint"
      @change="updateValue($event.target.value ? Math.round(parseFloat($event.target.value) * 100) : '')"
    ></wa-input>

    <!-- RichText -->
    <div v-else-if="field.type === 'RichText'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <RichTextEditor
        :modelValue="modelValue || ''"
        :disabled="field.readonly === true ? true : undefined"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- HTML Source Editor -->
    <div v-else-if="field.type === 'Html'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <HtmlEditor
        :modelValue="modelValue || ''"
        :disabled="field.readonly === true ? true : undefined"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- JSON Editor (Monaco with language=json) -->
    <div v-else-if="field.type === 'Json'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <HtmlEditor
        :modelValue="jsonStringValue"
        :disabled="field.readonly === true ? true : undefined"
        language="json"
        height="200px"
        @update:modelValue="handleJsonUpdate($event)"
      />
      <span v-if="jsonError" class="form-hint" style="color: var(--color-error);">⚠ Ungültiges JSON: {{ jsonError }}</span>
      <span v-else-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Object Array (Recursive nested form fields) -->
    <div v-else-if="field.type === 'ObjectArray'" class="form-group object-array-container">
      <label class="form-label object-array-main-label">{{ field.label }}</label>
      <p v-if="field.description" class="form-hint" style="margin-bottom: var(--space-sm);">{{ field.description }}</p>
      
      <div class="object-array">
      <div v-for="(item, index) in (modelValue || [])" :key="index" class="object-array-item card">
        <div class="object-array-header">
          <span class="object-array-title">Eintrag {{ index + 1 }}</span>
          <wa-button size="small" variant="warning" @click="removeArrayItem(index)" :disabled="field.readonly === true ? true : undefined">Entfernen</wa-button>
        </div>
        <div class="object-array-fields" :style="getObjectArrayFieldsStyle(field)">
          <FormField
            v-for="subField in field.itemFields"
            :key="subField.name"
            :field="field.readonly === true ? { ...subField, readonly: true } : subField"
            :context="item"
            :modelValue="item[subField.name]"
            :style="getObjectArrayFieldStyle(subField, field)"
            @update:modelValue="updateArrayItemField(index, subField.name, $event)"
          />
        </div>
      </div>
      </div>
      <wa-button size="small" @click="addArrayItem" :disabled="field.readonly === true ? true : undefined" style="margin-top: var(--space-sm);">
        + Neuer Eintrag
      </wa-button>
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

    <!-- Addon Selector -->
    <div v-else-if="field.type === 'AddonSelector'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <p v-if="field.description" class="form-hint" style="margin-bottom: var(--space-sm);">{{ field.description }}</p>
      <AddonSelector
        :modelValue="modelValue || []"
        :context="context"
        @update:modelValue="updateValue($event)"
      />
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- File (for direct uploads) -->
    <div v-else-if="field.type === 'File'" class="form-group">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <div class="file-upload-wrapper" style="display: flex; align-items: center; gap: 1rem;">
        <wa-button @click="$refs.fileInput.click()">
          <wa-icon slot="prefix" name="cloud-arrow-up"></wa-icon>
          Datei auswählen
        </wa-button>
        <span v-if="modelValue?.name" class="file-name">{{ modelValue.name }}</span>
        <input
          ref="fileInput"
          type="file"
          hidden
          :required="field.required === true && !modelValue"
          :disabled="field.readonly === true ? true : undefined"
          @change="updateValue($event.target.files[0])"
        />
      </div>
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- ImagePreview -->
    <div v-else-if="field.type === 'ImagePreview'" class="form-group">
      <label class="form-label">{{ field.label }}</label>
      <div v-if="context && context.url" class="image-preview-wrapper">
        <video v-if="context.mimeType?.startsWith('video/')" :src="context.url" controls class="form-preview-media"></video>
        <img v-else :src="context.url + '?v=small'" class="form-preview-media" />
      </div>
      <p v-else class="form-hint">Keine Vorschau verfügbar.</p>
    </div>

    <!-- Tags / Chips -->
    <TagsInput
      v-else-if="field.type === 'Tags'"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true"
      :options="field.options || []"
      :reference="field.reference || ''"
      :hint="field.hint"
      :modelValue="modelValue || []"
      @update:modelValue="updateValue"
    />

    <!-- Slug -->
    <SlugField
      v-else-if="field.type === 'Slug'"
      :field="field"
      :context="context"
      :modelValue="modelValue"
      @update:modelValue="updateValue"
    />

    <!-- MacroCopy -->
    <div v-else-if="field.type === 'MacroCopy'" class="form-group">
      <label class="form-label">{{ field.label }}</label>
      <div class="macro-copy-wrapper" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
        <span class="macro-display-code" style="font-family: monospace; background: var(--color-bg-alt); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: var(--text-sm); user-select: all;">
          [[media id="{{ context.slug || context._id }}"]]
        </span>
        <wa-button size="small" @click="copyFormMacro(context.slug || context._id, $event)">
          <wa-icon name="copy" slot="prefix"></wa-icon> Kopieren
        </wa-button>
      </div>
      <span v-if="field.hint" class="form-hint" style="display:block; margin-top:var(--space-xs);">{{ field.hint }}</span>
    </div>

    <!-- Autocomplete (single value text with suggestions) -->
    <div v-else-if="field.type === 'Autocomplete'" class="form-group autocomplete-wrapper">
      <label :class="['form-label', { required: field.required === true }]">{{ field.label }}</label>
      <div class="autocomplete-container">
        <input
          ref="autocompleteInputEl"
          type="text"
          class="autocomplete-input"
          :value="modelValue || ''"
          :placeholder="field.placeholder || 'Eingabe …'"
          :disabled="field.readonly === true"
          @input="updateValue($event.target.value); autocompleteOpen = true"
          @focus="autocompleteOpen = true"
          @blur="closeAutocompleteSoon"
        />
        <div class="autocomplete-dropdown" v-if="autocompleteOpen && autocompleteSuggestions.length">
          <div
            v-for="s in autocompleteSuggestions"
            :key="s"
            class="autocomplete-option"
            @mousedown.prevent="updateValue(s); autocompleteOpen = false"
          >
            {{ s }}
          </div>
        </div>
      </div>
      <span v-if="field.hint" class="form-hint">{{ field.hint }}</span>
    </div>

    <!-- Default: Text -->
    <wa-input
      v-else
      type="text"
      :label="field.label"
      :required="field.required === true"
      :disabled="field.readonly === true ? true : undefined"
      :value="modelValue || ''"
      :placeholder="field.placeholder || ''"
      :help-text="field.hint"
      @input="handleTextInput($event.target.value)"
    ></wa-input>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed, watch, ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

import RichTextEditor from './RichTextEditor.vue';
import HtmlEditor from './HtmlEditor.vue';
import MediaSelector from './MediaSelector.vue';
import AddonSelector from './AddonSelector.vue';
import RelationSelector from './RelationSelector.vue';
import OfferingSelector from './OfferingSelector.vue';
import TagsInput from './TagsInput.vue';
import SlugField from './SlugField.vue';

const props = defineProps({
    field: { type: Object, required: true },
    context: { type: Object, default: () => ({}) },
    modelValue: { required: true },
    useWebAwesome: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'select']);

const copyFormMacro = async (id, event) => {
    try {
        await navigator.clipboard.writeText(`[[media id="${id}"]]`);
        const btn = event.currentTarget;
        const originalText = btn.innerText;
        btn.innerText = '✓ Kopiert!';
        btn.style.color = 'var(--color-success)';
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.color = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy macro', err);
    }
};

const updateValue = (val) => {
    emit('update:modelValue', val);
};

// --- Json field type helpers ---
const jsonError = ref('');

const jsonStringValue = computed(() => {
    const val = props.modelValue;
    if (val === undefined || val === null) return '{}';
    if (typeof val === 'string') return val;
    try {
        return JSON.stringify(val, null, 2);
    } catch {
        return '{}';
    }
});

const handleJsonUpdate = (str) => {
    try {
        const parsed = JSON.parse(str);
        jsonError.value = '';
        updateValue(parsed);
    } catch (e) {
        jsonError.value = e.message;
        // Don't emit invalid JSON — keep the string in the editor
    }
};

// --- Autocomplete field type helpers ---
const autocompleteOpen = ref(false);
const autocompleteInputEl = ref(null);
const autocompleteDynamic = ref([]);

const autocompleteSuggestions = computed(() => {
    const statics = props.field?.options || [];
    const merged = new Set([...statics, ...autocompleteDynamic.value]);
    const q = (props.modelValue || '').toLowerCase().trim();
    return [...merged]
        .filter(opt => q === '' || opt.toLowerCase().includes(q))
        .sort((a, b) => a.localeCompare(b));
});

const closeAutocompleteSoon = () => {
    setTimeout(() => { autocompleteOpen.value = false; }, 150);
};

onMounted(async () => {
    if (props.field?.type === 'Autocomplete' && props.field?.reference) {
        try {
            autocompleteDynamic.value = await api.get(props.field.reference);
        } catch { /* static options only */ }
    }
});

const handleTextInput = (val) => {
    let result = val;
    if (props.field?.name === 'license') {
        const l = val.toLowerCase().replace(/[^a-z0-9]/g, '');
        let link = '';
        let norm = val;

        if (l === 'ccby' || l === 'ccby40') { norm = 'CC BY 4.0'; link = 'https://creativecommons.org/licenses/by/4.0/deed.de'; }
        else if (l === 'ccbysa' || l === 'ccbysa40') { norm = 'CC BY-SA 4.0'; link = 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'; }
        else if (l === 'cc0' || l === 'cc010') { norm = 'CC0 1.0 Universal'; link = 'https://creativecommons.org/publicdomain/zero/1.0/deed.de'; }
        else if (l === 'ccbync' || l === 'ccbync40') { norm = 'CC BY-NC 4.0'; link = 'https://creativecommons.org/licenses/by-nc/4.0/deed.de'; }
        else if (l === 'ccbyncsa' || l === 'ccbyncsa40') { norm = 'CC BY-NC-SA 4.0'; link = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de'; }
        else if (l === 'ccbynd' || l === 'ccbynd40') { norm = 'CC BY-ND 4.0'; link = 'https://creativecommons.org/licenses/by-nd/4.0/deed.de'; }
        else if (l === 'ccbyncnd' || l === 'ccbyncnd40') { norm = 'CC BY-NC-ND 4.0'; link = 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de'; }

        if (link && props.context) {
            if (!props.context.licenseLink || props.context.licenseLink.includes('creativecommons.org')) {
                props.context.licenseLink = link;
                result = norm;
            }
        }
    }
    updateValue(result);
};

// Ensure empty string representation
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

const resolvedOptions = computed(() => {
    if (!props.field.options) return [];
    
    // Static options only for generic Select
    return props.field.options.map(opt => {
        if (typeof opt === 'string') return { value: opt, label: opt };
        return opt;
    });
});

// Set default values
watch(() => [props.field?.type, props.field?.default], ([, newDefault]) => {
    if (props.modelValue === undefined && newDefault !== undefined) {
        updateValue(newDefault);
    } else if (props.field?.type === 'ObjectArray' && !props.modelValue) {
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

const getObjectArrayFieldsStyle = (fieldDef) => {
    if (!fieldDef.grid || fieldDef.grid.length === 0) return {};
    
    // Count columns from the first row of the grid definition
    const firstRowTokens = fieldDef.grid[0].trim().split(/\s+/);
    const colsCount = firstRowTokens.length;
    
    const safeAreas = fieldDef.grid.map(row => {
        return row.split(/\s+/).map(token => {
            if (token === '.') return '.';
            return token.replace(/\./g, '_');
        }).join(' ');
    });
    
    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`,
        gridTemplateRows: 'auto',
        gridTemplateAreas: safeAreas.map(row => `"${row}"`).join(' '),
        gap: '1rem'
    };
};

const getObjectArrayFieldStyle = (subField, fieldDef) => {
    if (!fieldDef.grid || fieldDef.grid.length === 0) return {};
    return { gridArea: subField.name.replace(/\./g, '_') };
};
</script>

<style scoped>
.form-field-content > * {
    margin-bottom: var(--space-md);
    display: block;
}
.form-field-content > *:last-child {
    margin-bottom: 0;
}

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
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-base);
    color: var(--color-primary-dark);
}

.object-array-main-label {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-lg);
    color: var(--color-primary-dark);
    margin-bottom: var(--space-xs);
    display: block;
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

.autocomplete-wrapper {
    position: relative;
}

.autocomplete-container {
    position: relative;
}

.autocomplete-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--text-sm);
    color: var(--color-text);
    outline: none;
    box-sizing: border-box;
}
.autocomplete-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(46, 86, 65, 0.15);
}
.autocomplete-input:disabled {
    background: var(--color-bg-alt);
    opacity: 0.8;
}

.autocomplete-dropdown {
    position: absolute;
    z-index: 100;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    max-height: 200px;
    overflow-y: auto;
    margin-top: 4px;
}

.autocomplete-option {
    padding: 8px 12px;
    font-size: var(--text-sm);
    cursor: pointer;
}
.autocomplete-option:hover {
    background: var(--color-primary-50, rgba(46, 86, 65, 0.08));
    color: var(--color-primary-dark);
}

</style>
