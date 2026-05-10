<template>
  <div class="rich-text-editor">
    <div class="quill-wrapper" :class="{ 'source-mode': showSource }">
      <wa-button 
        size="small"
        appearance="plain"
        class="btn-toggle-source" 
        @click="showSource = !showSource"
        title="Quelltext-Ansicht umschalten"
      >
        <wa-icon :name="showSource ? 'eye' : 'code-slash'" slot="prefix"></wa-icon>
        {{ showSource ? 'WYSIWYG' : 'HTML' }}
      </wa-button>

      <QuillEditor 
        theme="snow" 
        :content="modelValue" 
        contentType="html"
        :readOnly="disabled"
        @update:content="updateContent" 
        toolbar="essential"
      />
    </div>

    <!-- Source Code View -->
    <wa-textarea
      v-if="showSource"
      class="source-editor"
      :value="modelValue"
      @input="updateContent($event.target.value)"
      :disabled="disabled"
      placeholder="<p>HTML Code hier eingeben...</p>"
    ></wa-textarea>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);
const showSource = ref(false);

const updateContent = (content) => {
    emit('update:modelValue', content);
};
</script>

<style scoped>
.rich-text-editor {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border-light, #e2e8f0);
  background: var(--color-bg, white);
  overflow: hidden;
}

.btn-toggle-source {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 10;
  color: var(--color-text-muted, #64748b);
}

.quill-wrapper {
  position: relative;
  background: var(--color-bg, white);
  display: flex;
  flex-direction: column;
}

.source-editor {
  width: 100%;
}
.source-editor::part(base) {
  border: none;
  border-radius: 0;
}
.source-editor::part(textarea) {
  min-height: 200px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  background: #1e1e1e;
  color: #d4d4d4;
  resize: vertical;
  line-height: 1.5;
}
.source-editor::part(textarea):focus {
  outline: none;
}

:deep(.ql-editor) {
    min-height: 200px;
}
:deep(.ql-toolbar.ql-snow) {
    border: none;
    border-bottom: 1px solid var(--color-border-light, #e2e8f0) !important;
    background: var(--color-bg, #f8fafc);
    padding-right: 120px; /* Space for absolute button */
}
.source-mode :deep(.ql-toolbar.ql-snow) {
    border-bottom: none !important;
}
.source-mode :deep(.ql-formats) {
    opacity: 0.4;
    pointer-events: none;
}
.source-mode :deep(.ql-container) {
    display: none !important;
}
:deep(.ql-container.ql-snow) {
    border: none !important;
    font-size: var(--text-base, 1rem);
}
:deep(.ql-editor[contenteditable=false]) {
    background-color: var(--color-bg, white);
    color: var(--color-text-muted, #64748b);
}
</style>
