<template>
  <div class="rich-text-editor" :class="{ 'source-mode': showSource }">
    <!-- Header / Toolbar -->
    <div class="editor-header">
      <div v-if="!showSource && editor" class="tiptap-toolbar">
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('bold') }" 
          @click="editor.chain().focus().toggleBold().run()"
          title="Fett"
        >
          <b>B</b>
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('italic') }" 
          @click="editor.chain().focus().toggleItalic().run()"
          title="Kursiv"
        >
          <i>I</i>
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('strike') }" 
          @click="editor.chain().focus().toggleStrike().run()"
          title="Durchgestrichen"
        >
          <s>S</s>
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" 
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          title="Überschrift 2"
        >
          H2
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" 
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          title="Überschrift 3"
        >
          H3
        </button>
        <span class="toolbar-divider"></span>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('bulletList') }" 
          @click="editor.chain().focus().toggleBulletList().run()"
          title="Aufzählung"
        >
          • List
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('orderedList') }" 
          @click="editor.chain().focus().toggleOrderedList().run()"
          title="Nummerierte Liste"
        >
          1. List
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          :class="{ 'is-active': editor.isActive('blockquote') }" 
          @click="editor.chain().focus().toggleBlockquote().run()"
          title="Zitat"
        >
          ”
        </button>
        <button 
          type="button"
          class="toolbar-btn" 
          @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
          title="Formatierung löschen"
        >
          ✕
        </button>
      </div>

      <span v-else class="source-label">HTML Quelltext</span>

      <!-- Toggle Button -->
      <wa-button 
        size="small"
        appearance="plain"
        class="btn-toggle-source" 
        @click="toggleSource"
        title="Quelltext-Ansicht umschalten"
      >
        <wa-icon :name="showSource ? 'eye' : 'code-slash'" slot="prefix"></wa-icon>
        {{ showSource ? 'WYSIWYG' : 'HTML' }}
      </wa-button>
    </div>

    <!-- WYSIWYG View (Tiptap) -->
    <div v-show="!showSource" class="tiptap-wrapper">
      <editor-content :editor="editor" class="tiptap-content" />
    </div>

    <!-- Source Code View -->
    <div v-if="showSource" class="source-wrapper">
      <textarea
        class="source-editor"
        v-model="sourceText"
        @input="handleSourceInput"
        :disabled="disabled"
        placeholder="<p>HTML Code hier eingeben...</p>"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);
const showSource = ref(false);
const sourceText = ref(props.modelValue || '');

const editor = useEditor({
  content: props.modelValue || '',
  editable: !props.disabled,
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    if (!showSource.value) {
      const html = editor.getHTML();
      sourceText.value = html;
      emit('update:modelValue', html);
    }
  }
});

watch(() => props.disabled, (newDisabled) => {
  if (editor.value) {
    editor.value.setEditable(!newDisabled);
  }
});

watch(() => props.modelValue, (newVal) => {
  const currentHtml = editor.value ? editor.value.getHTML() : '';
  if (newVal !== currentHtml && newVal !== sourceText.value) {
    sourceText.value = newVal || '';
    if (editor.value) {
      editor.value.commands.setContent(newVal || '', false);
    }
  }
});

const toggleSource = () => {
  if (!showSource.value) {
    // Switch to source mode: update sourceText from editor
    sourceText.value = editor.value ? editor.value.getHTML() : props.modelValue || '';
  } else {
    // Switch to WYSIWYG mode: update editor content from sourceText
    if (editor.value) {
      editor.value.commands.setContent(sourceText.value || '', false);
      emit('update:modelValue', sourceText.value);
    }
  }
  showSource.value = !showSource.value;
};

const handleSourceInput = () => {
  emit('update:modelValue', sourceText.value);
};

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});
</script>

<style scoped>
.rich-text-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border-light, #e2e8f0);
  background: var(--color-bg, white);
  overflow: hidden;
}

.editor-header {
  min-height: 42px;
  background: var(--color-bg, #f8fafc);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0.75rem;
}

.tiptap-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.toolbar-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 4px);
  padding: 4px 8px;
  font-size: 0.85rem;
  color: var(--color-text, #334155);
  cursor: pointer;
  line-height: 1.2;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: var(--color-bg-alt, #e2e8f0);
}

.toolbar-btn.is-active {
  background: var(--color-primary-light, #e0f2fe);
  color: var(--color-primary-dark, #0284c7);
  font-weight: bold;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border-light, #cbd5e1);
  margin: 0 4px;
}

.source-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted, #64748b);
}

.btn-toggle-source {
  color: var(--color-text-muted, #64748b);
  margin-left: auto;
}

.tiptap-wrapper {
  background: var(--color-bg, white);
  min-height: 200px;
}

.tiptap-content :deep(.ProseMirror) {
  min-height: 200px;
  padding: 1rem;
  outline: none;
  font-family: inherit;
  font-size: var(--text-base, 1rem);
  line-height: 1.6;
}

.tiptap-content :deep(.ProseMirror p) {
  margin-bottom: 0.75em;
}

.tiptap-content :deep(.ProseMirror h2) {
  font-size: 1.35rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.tiptap-content :deep(.ProseMirror h3) {
  font-size: 1.15rem;
  font-weight: bold;
  margin-top: 0.85em;
  margin-bottom: 0.4em;
}

.tiptap-content :deep(.ProseMirror ul),
.tiptap-content :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.75em;
}

.tiptap-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--color-primary, #0284c7);
  padding-left: 1rem;
  margin-left: 0;
  color: var(--color-text-muted, #64748b);
  font-style: italic;
}

.source-wrapper {
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.source-editor {
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  background: #1e1e1e;
  color: #d4d4d4;
  resize: vertical;
  line-height: 1.5;
  border: none;
  outline: none;
  box-sizing: border-box;
}
</style>
