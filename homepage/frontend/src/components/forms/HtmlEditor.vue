<template>
  <div class="html-editor-container">
    <VueMonacoEditor
      v-model:value="content"
      theme="vs-dark"
      :language="language"
      :options="editorOptions"
      @change="handleChange"
      :height="height"
    />

    <!-- Macro Reference (only for HTML mode) -->
    <details v-if="language === 'html'" class="macro-reference">
      <summary class="macro-reference-toggle">Verfügbare Makros</summary>
      <div class="macro-reference-content">
        <div v-for="[name, def] in macroList" :key="name" class="macro-ref-item">
          <div class="macro-ref-header">
            <code class="macro-ref-name">{{ name }}</code>
            <span class="macro-ref-label">{{ def.label }}</span>
          </div>
          <div class="macro-ref-example">
            <code>{{ def.example }}</code>
            <button type="button" class="macro-ref-copy" @click="copyText(def.example, $event)" title="Kopieren">📋</button>
          </div>
          <div v-if="def.props.length" class="macro-ref-props">
            <span v-for="p in def.props" :key="p.name" class="macro-ref-prop" :title="p.desc">
              <code>{{ p.name }}</code><span v-if="p.required" class="macro-ref-req">*</span>
            </span>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { ref, watch, computed, defineProps, defineEmits } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { getMacroList } from '../../utils/macroRegistry.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  language: { type: String, default: 'html' },
  height: { type: String, default: '400px' }
})
const emit = defineEmits(['update:modelValue'])

const content = ref(props.modelValue)
const macroList = getMacroList()

const copyText = async (text, event) => {
    try {
        await navigator.clipboard.writeText(text)
        const btn = event.currentTarget
        const orig = btn.textContent
        btn.textContent = '✓'
        setTimeout(() => { btn.textContent = orig }, 1500)
    } catch { /* ignore */ }
}

watch(() => props.modelValue, (newVal) => {
    if (newVal !== content.value) {
        content.value = newVal
    }
})

const handleChange = (value) => {
    emit('update:modelValue', value)
}

const editorOptions = computed(() => ({
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  readOnly: props.disabled,
  minimap: { enabled: false },
  wordWrap: 'on',
  suggestOnTriggerCharacters: true
}))
</script>

<style scoped>
.html-editor-container {
    border: 1px solid var(--color-border-light, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
    background-color: #1e1e1e; /* Match monaco dark theme background */
}

/* Macro reference panel */
.macro-reference {
    background: var(--color-surface, #fff);
    border-top: 1px solid var(--color-border-light, #e2e8f0);
}

.macro-reference-toggle {
    cursor: pointer;
    padding: var(--space-xs, 0.5rem) var(--space-sm, 0.75rem);
    background: var(--color-bg-alt, #f7fafc);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-muted);
    font-weight: 500;
    user-select: none;
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-xs, 0.5rem);
}
.macro-reference-toggle::before {
    content: '▸';
    transition: transform 0.15s ease;
    display: inline-block;
}
.macro-reference[open] > .macro-reference-toggle::before {
    transform: rotate(90deg);
}
.macro-reference-toggle:hover {
    color: var(--color-text);
    background: var(--color-bg, #edf2f7);
}

.macro-reference-content {
    padding: var(--space-sm, 0.75rem);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-sm, 0.75rem);
    max-height: 320px;
    overflow-y: auto;
}

.macro-ref-item {
    background: var(--color-surface, #fff);
    border: 1px solid var(--color-border-light, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    padding: var(--space-xs, 0.5rem) var(--space-sm, 0.75rem);
    font-size: var(--text-xs, 0.75rem);
}

.macro-ref-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs, 0.5rem);
    margin-bottom: 4px;
}
.macro-ref-name {
    font-weight: 700;
    color: var(--color-primary-dark);
    font-size: var(--text-sm, 0.875rem);
}
.macro-ref-label {
    color: var(--color-text-muted);
}

.macro-ref-example {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--color-bg-alt, #f7fafc);
    padding: 2px 6px;
    border-radius: var(--radius-sm, 4px);
    margin-bottom: 4px;
}
.macro-ref-example code {
    flex: 1;
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text);
    word-break: break-all;
}
.macro-ref-copy {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    line-height: 1;
    opacity: 0.6;
}
.macro-ref-copy:hover {
    opacity: 1;
}

.macro-ref-props {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.macro-ref-prop {
    background: var(--color-bg-alt, #f7fafc);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.7rem;
    color: var(--color-text-muted);
}
.macro-ref-prop code {
    color: var(--color-primary-dark);
}
.macro-ref-req {
    color: var(--color-error, #e53935);
    font-weight: bold;
}
</style>
