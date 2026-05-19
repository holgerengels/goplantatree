<template>
  <div class="tags-input" :class="{ disabled: disabled }">
    <label v-if="label" class="form-label" :class="{ required }">{{ label }}</label>
    <div class="tags-container" @click="focusInput">
      <span v-for="(tag, i) in tags" :key="tag" class="tag-chip">
        {{ tag }}
        <button v-if="!disabled" type="button" class="tag-remove" @click.stop="removeTag(i)" aria-label="Entfernen">×</button>
      </span>
      <input
        v-if="!disabled"
        ref="inputEl"
        type="text"
        class="tag-input"
        :placeholder="tags.length ? '' : placeholder"
        v-model="inputValue"
        @keydown.enter.prevent="addCurrentTag"
        @keydown.comma.prevent="addCurrentTag"
        @keydown.backspace="onBackspace"
        @input="onInput"
        @focus="showSuggestions = true"
        @blur="onBlur"
      />
    </div>
    <!-- Autocomplete dropdown -->
    <div class="tags-suggestions" v-if="showSuggestions && filteredSuggestions.length">
      <div
        v-for="s in filteredSuggestions"
        :key="s"
        class="tags-suggestion"
        @mousedown.prevent="selectSuggestion(s)"
      >
        {{ s }}
      </div>
    </div>
    <span v-if="hint" class="form-hint">{{ hint }}</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  reference: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Eingabe + Enter …' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const inputEl = ref(null);
const inputValue = ref('');
const showSuggestions = ref(false);
const dynamicOptions = ref([]);

const tags = computed(() => props.modelValue || []);

// Merge static options from config with dynamic values from DB
const allOptions = computed(() => {
  const merged = new Set([...props.options, ...dynamicOptions.value]);
  return [...merged].sort((a, b) => a.localeCompare(b));
});

const filteredSuggestions = computed(() => {
  const q = inputValue.value.toLowerCase().trim();
  return allOptions.value.filter(
    opt => !tags.value.includes(opt) && (q === '' || opt.toLowerCase().includes(q))
  );
});

const addTag = (tag) => {
  const trimmed = tag.trim();
  if (!trimmed || tags.value.includes(trimmed)) return;
  emit('update:modelValue', [...tags.value, trimmed]);
  inputValue.value = '';
};

const addCurrentTag = () => {
  if (inputValue.value.trim()) {
    addTag(inputValue.value);
  }
};

const removeTag = (index) => {
  const newTags = [...tags.value];
  newTags.splice(index, 1);
  emit('update:modelValue', newTags);
};

const onBackspace = () => {
  if (!inputValue.value && tags.value.length) {
    removeTag(tags.value.length - 1);
  }
};

const selectSuggestion = (s) => {
  addTag(s);
  showSuggestions.value = false;
};

const onInput = () => {
  showSuggestions.value = true;
};

const onBlur = () => {
  // Delay hiding to allow mousedown on suggestion
  setTimeout(() => { showSuggestions.value = false; }, 150);
};

const focusInput = () => {
  inputEl.value?.focus();
};

onMounted(async () => {
  if (props.reference) {
    try {
      dynamicOptions.value = await api.get(props.reference);
    } catch { /* static options only */ }
  }
});
</script>

<style scoped>
.tags-input {
  position: relative;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: text;
  min-height: 42px;
  align-items: center;
}

.tags-input.disabled .tags-container {
  background: var(--color-bg-alt);
  cursor: default;
  opacity: 0.8;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary-50, rgba(46, 86, 65, 0.1));
  color: var(--color-primary-dark);
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.6;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
}
.tag-remove:hover {
  color: var(--color-error);
}

.tag-input {
  flex: 1;
  min-width: 80px;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--text-sm);
  padding: 2px 0;
  color: var(--color-text);
}

.tags-suggestions {
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

.tags-suggestion {
  padding: 8px 12px;
  font-size: var(--text-sm);
  cursor: pointer;
}
.tags-suggestion:hover {
  background: var(--color-primary-50, rgba(46, 86, 65, 0.08));
  color: var(--color-primary-dark);
}
</style>
