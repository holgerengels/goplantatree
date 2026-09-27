<template>
  <div class="html-editor-container">
    <!-- Toolbar (only for HTML mode) -->
    <div v-if="language === 'html'" class="html-editor-toolbar">
      <div class="toolbar-group">
        <label for="section-insert-select" class="toolbar-label">
          <span>➕</span> Sektion / Vorlage einfügen:
        </label>
        <select
          id="section-insert-select"
          class="toolbar-select"
          @change="onInsertSelect($event)"
          :disabled="disabled"
        >
          <option value="" disabled selected>Vorlage auswählen…</option>
          <optgroup label="Sektionen">
            <option value="section-primary">Primary (.section-primary)</option>
            <option value="section-secondary">Secondary (.section-secondary)</option>
            <option value="section-alt">Alt (.section-alt)</option>
            <option value="section-surface">Surface (.section-surface)</option>
            <option value="section-actions">Actions (.section-actions)</option>
          </optgroup>
          <optgroup label="Elemente">
            <option value="block-title">Block Title (.block-title)</option>
            <option value="elem-cta">CTA (Button)</option>
            <option value="card">Card (.card)</option>
          </optgroup>
          <optgroup label="Makros">
            <option v-for="[name, def] in macroList" :key="name" :value="'macro:' + name">
              [[{{ name }}]] – {{ def.label }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Quick action buttons for the most common section styles -->
      <div class="toolbar-actions">
        <button
          type="button"
          class="toolbar-btn"
          title="Titel & Untertitel (.block-title)"
          :disabled="disabled"
          @click="insertSnippetByKey('block-title')"
        >
          + Title
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Primary Sektion (.section-primary)"
          :disabled="disabled"
          @click="insertSnippetByKey('section-primary')"
        >
          + Primary
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Aktionen / Buttons (.section-actions)"
          :disabled="disabled"
          @click="insertSnippetByKey('section-actions')"
        >
          + Actions
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Call-to-Action Button"
          :disabled="disabled"
          @click="insertSnippetByKey('elem-cta')"
        >
          + CTA
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Card (.card)"
          :disabled="disabled"
          @click="insertSnippetByKey('card')"
        >
          + Card
        </button>
      </div>
    </div>

    <VueMonacoEditor
      v-model:value="content"
      theme="vs-dark"
      :language="language"
      :options="editorOptions"
      @change="handleChange"
      @mount="handleEditorMount"
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
import { ref, shallowRef, markRaw, watch, computed } from 'vue';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';
import { getMacroList, macroRegistry } from '../../utils/macroRegistry.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  language: { type: String, default: 'html' },
  height: { type: String, default: '400px' }
});
const emit = defineEmits(['update:modelValue']);

const content = ref(props.modelValue);
const macroList = getMacroList();
const editorInstance = shallowRef(null);
const monacoInstance = shallowRef(null);

const SNIPPETS = {
  'block-title': [
    '<div class="block-title">',
    '  <h2>${1:Titel}</h2>',
    '  <p>${2:Untertitel}</p>',
    '</div>'
  ].join('\n'),

  'section-primary': [
    '<section class="section-primary">',
    '  <div class="block-title">',
    '    <h2>${1:Titel der Sektion}</h2>',
    '    <p>${2:Untertitel der Sektion}</p>',
    '  </div>',
    '  <p>${3:Inhalt der Sektion hier eingeben...}</p>',
    '</section>'
  ].join('\n'),

  'section-secondary': [
    '<section class="section-secondary">',
    '  <div class="block-title">',
    '    <h2>${1:Titel der Sektion}</h2>',
    '    <p>${2:Untertitel der Sektion}</p>',
    '  </div>',
    '  <p>${3:Inhalt der Sektion hier eingeben...}</p>',
    '</section>'
  ].join('\n'),

  'section-alt': [
    '<section class="section-alt">',
    '  <div class="block-title">',
    '    <h2>${1:Titel der Sektion}</h2>',
    '    <p>${2:Untertitel der Sektion}</p>',
    '  </div>',
    '  <p>${3:Inhalt der Sektion hier eingeben...}</p>',
    '</section>'
  ].join('\n'),

  'section-surface': [
    '<section class="section-surface">',
    '  <div class="block-title">',
    '    <h2>${1:Titel der Sektion}</h2>',
    '    <p>${2:Untertitel der Sektion}</p>',
    '  </div>',
    '  <p>${3:Inhalt der Sektion hier eingeben...}</p>',
    '</section>'
  ].join('\n'),

  'section-actions': [
    '<div class="section-actions">',
    '  <a href="${1:/seite/ziel}" class="btn btn-primary">${2:Aktionsbutton}</a>',
    '</div>'
  ].join('\n'),

  'section-more': [
    '<div class="section-actions">',
    '  <a href="${1:/seite/ziel}" class="btn btn-primary">${2:Aktionsbutton}</a>',
    '</div>'
  ].join('\n'),

  'elem-cta': '<a href="${1:/seite/ziel}" class="btn btn-primary">${2:Aktionsbutton}</a>',

  'card': [
    '<div class="card">',
    '  <h3>${1:Karten-Titel}</h3>',
    '  <p>${2:Karten-Inhalt...}</p>',
    '</div>'
  ].join('\n')
};

const copyText = async (text, event) => {
    try {
        await navigator.clipboard.writeText(text);
        const btn = event.currentTarget;
        const orig = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch { /* ignore */ }
};

watch(() => props.modelValue, (newVal) => {
    const currentVal = editorInstance.value ? editorInstance.value.getValue() : content.value;
    if (newVal !== currentVal) {
        content.value = newVal;
    }
});

const handleChange = (value) => {
    if (value !== props.modelValue) {
        emit('update:modelValue', value);
    }
};

const insertSnippetByText = (snippetText) => {
    // Strip snippet placeholder syntax (e.g. ${1:Titel} -> Titel)
    const cleanText = snippetText.replace(/\$\{\d+:?([^}]*)\}/g, '$1');

    if (!editorInstance.value) {
        content.value = (content.value ? content.value + '\n\n' : '') + cleanText;
        emit('update:modelValue', content.value);
        return;
    }

    const editor = editorInstance.value;
    const model = editor.getModel();
    if (!model) return;

    editor.focus();

    let selection = editor.getSelection();
    if (!selection) {
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        selection = monacoInstance.value
            ? new monacoInstance.value.Range(lastLine, lastCol, lastLine, lastCol)
            : { startLineNumber: lastLine, startColumn: lastCol, endLineNumber: lastLine, endColumn: lastCol };
    }

    // Insert clean text safely via standard Monaco edit operation
    editor.pushUndoStop();
    editor.executeEdits('toolbar-insert', [{
        range: selection,
        text: cleanText,
        forceMoveMarkers: true
    }]);
    editor.pushUndoStop();
};

const insertSnippetByKey = (key) => {
    const snippet = SNIPPETS[key];
    if (snippet) {
        insertSnippetByText(snippet);
    }
};

const onInsertSelect = (event) => {
    const val = event.target.value;
    if (!val) return;

    if (val.startsWith('macro:')) {
        const macroName = val.replace('macro:', '');
        const macroDef = macroRegistry[macroName];
        if (macroDef && macroDef.example) {
            insertSnippetByText(macroDef.example);
        } else {
            insertSnippetByText(`[[${macroName}]]`);
        }
    } else if (SNIPPETS[val]) {
        insertSnippetByKey(val);
    }

    // Reset dropdown cleanly
    event.target.selectedIndex = 0;
};

// Monaco Autocompletions (Register once)
let isRegistered = false;

const registerMonacoCompletions = (monaco) => {
    if (isRegistered || !monaco) return;
    isRegistered = true;

    monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: ['<', '.', '[', '-', '"', ' '],
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            const lineUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });

            const suggestions = [];

            // 1. Sektionen & Vorlagen (Snippets)
            const sectionSnippets = [
                {
                    label: 'block-title',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['block-title'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Block Title (.block-title)',
                    documentation: 'Zentrierter Titelblock (H2 + Untertitel)'
                },
                {
                    label: 'section-primary',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-primary'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Primary (.section-primary)',
                    documentation: 'Breite Sektion im Primary-Stil mit Titelblock und Inhalt'
                },
                {
                    label: 'section-secondary',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-secondary'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Secondary (.section-secondary)',
                    documentation: 'Breite Sektion im Secondary-Stil mit Titelblock und Inhalt'
                },
                {
                    label: 'section-alt',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-alt'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Alt (.section-alt)',
                    documentation: 'Breite Sektion im Alt-Stil mit Titelblock und Inhalt'
                },
                {
                    label: 'section-surface',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-surface'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Surface (.section-surface)',
                    documentation: 'Breite Sektion im Surface-Stil mit Titelblock und Inhalt'
                },
                {
                    label: 'section-actions',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-actions'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Actions (.section-actions)',
                    documentation: 'Zentrierter Aktionsbereich für Buttons / Links'
                },
                {
                    label: 'section-more',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['section-more'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'More (.section-more / Alias)',
                    documentation: 'Zentrierter Aktionsbereich (Alias für section-actions)'
                },
                {
                    label: 'cta',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['elem-cta'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'CTA (Button)',
                    documentation: 'Call-to-Action Link-Button (.btn.btn-primary)'
                },
                {
                    label: 'card',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: SNIPPETS['card'],
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Card (.card)',
                    documentation: 'Karten-Container für hervorhebbare Inhalte'
                }
            ];

            sectionSnippets.forEach(s => {
                suggestions.push({ ...s, range });
            });

            // 2. CSS-Klassen innerhalb class="..."
            const isInsideClass = /class\s*=\s*["'][^"']*$/.test(lineUntilPosition);
            if (isInsideClass) {
                const classes = [
                    { name: 'block-title', desc: 'Block Title (H2 + Untertitel)' },
                    { name: 'section-primary', desc: 'Primary Sektion' },
                    { name: 'section-secondary', desc: 'Secondary Sektion' },
                    { name: 'section-alt', desc: 'Alt Sektion' },
                    { name: 'section-surface', desc: 'Surface Sektion' },
                    { name: 'section-actions', desc: 'Actions / Button Sektion' },
                    { name: 'section-more', desc: 'Actions / More (Alias)' },
                    { name: 'full-width', desc: 'Volle Viewport-Breite Breakout' },
                    { name: 'card', desc: 'Card Container' },
                    { name: 'container', desc: 'Container' },
                    { name: 'btn', desc: 'Basis Button' },
                    { name: 'btn-primary', desc: 'Primary Button' },
                    { name: 'btn-secondary', desc: 'Secondary Button' },
                    { name: 'btn-accent', desc: 'Accent Button' },
                    { name: 'btn-lg', desc: 'Large Button' }
                ];

                classes.forEach(c => {
                    suggestions.push({
                        label: c.name,
                        kind: monaco.languages.CompletionItemKind.Value,
                        insertText: c.name,
                        detail: c.desc,
                        range
                    });
                });
            }

            // 3. Makro-Vervollständigungen ([[...]])
            const isDoubleBracket = lineUntilPosition.endsWith('[[');
            const isSingleBracket = !isDoubleBracket && lineUntilPosition.endsWith('[');
            let macroRange = range;
            if (isDoubleBracket) {
                macroRange = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column - 2,
                    endColumn: position.column
                };
            } else if (isSingleBracket) {
                macroRange = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column - 1,
                    endColumn: position.column
                };
            }

            const macroEntries = getMacroList();
            macroEntries.forEach(([name, def]) => {
                suggestions.push({
                    label: `[[${name}]]`,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: def.example,
                    detail: `Makro: ${def.label}`,
                    documentation: `Beispiel: ${def.example}`,
                    range: macroRange
                });
            });

            return { suggestions };
        }
    });
};

const handleEditorMount = (editor, monaco) => {
    editorInstance.value = markRaw(editor);
    monacoInstance.value = markRaw(monaco);
    registerMonacoCompletions(monaco);
};

const editorOptions = computed(() => ({
  automaticLayout: true,
  formatOnType: false,
  formatOnPaste: false,
  readOnly: props.disabled,
  minimap: { enabled: false },
  wordWrap: 'on',
  suggestOnTriggerCharacters: true
}));
</script>

<style scoped>
.html-editor-container {
    border: 1px solid var(--color-border-light, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
    background-color: #1e1e1e; /* Match monaco dark theme background */
}

/* Toolbar */
.html-editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm, 0.5rem);
    padding: var(--space-xs, 0.5rem) var(--space-sm, 0.75rem);
    background: #252526;
    border-bottom: 1px solid #333333;
}

.toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--space-xs, 0.5rem);
}

.toolbar-label {
    font-size: var(--text-xs, 0.75rem);
    font-weight: 600;
    color: #cccccc;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}

.toolbar-select {
    background: #1e1e1e;
    color: #eeeeee;
    border: 1px solid #444444;
    border-radius: var(--radius-sm, 4px);
    padding: 4px 10px;
    font-size: var(--text-xs, 0.75rem);
    cursor: pointer;
    outline: none;
    transition: border-color var(--transition-fast, 0.15s);
}

.toolbar-select:focus {
    border-color: var(--color-primary, #4caf50);
}

.toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.toolbar-btn {
    background: #2d2d2d;
    color: #eeeeee;
    border: 1px solid #444444;
    border-radius: var(--radius-sm, 4px);
    padding: 3px 10px;
    font-size: var(--text-xs, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
    background: var(--color-primary, #2e7d32);
    border-color: var(--color-primary, #2e7d32);
    color: #ffffff;
}

.toolbar-btn:disabled, .toolbar-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
