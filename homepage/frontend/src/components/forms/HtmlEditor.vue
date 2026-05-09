<template>
  <div class="html-editor-container">
    <VueMonacoEditor
      v-model:value="content"
      theme="vs-dark"
      language="html"
      :options="MONACO_EDITOR_OPTIONS"
      @change="handleChange"
      height="400px"
    />
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const content = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
    if (newVal !== content.value) {
        content.value = newVal
    }
})

const handleChange = (value) => {
    emit('update:modelValue', value)
}

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  readOnly: props.disabled,
  minimap: { enabled: false },
  wordWrap: 'on',
  suggestOnTriggerCharacters: true
}
</script>

<style scoped>
.html-editor-container {
    border: 1px solid var(--color-border-light, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
    background-color: #1e1e1e; /* Match monaco dark theme background */
}
</style>
