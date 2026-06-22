<template>
  <div class="addon-selector">
    <!-- Assigned addons as chips -->
    <div class="addon-chips" v-if="resolvedAddons.length">
      <div v-for="addon in resolvedAddons" :key="addon.slug" class="addon-chip">
        <span class="addon-chip-name">{{ addon.name }}</span>
        <button class="addon-chip-remove" @click.prevent="removeAddon(addon.slug)" title="Entfernen">&times;</button>
      </div>
    </div>
    <p v-else class="addon-empty">Keine Zusatzoptionen zugewiesen.</p>

    <!-- Action buttons -->
    <div class="addon-actions">
      <wa-button size="small" @click.prevent="openLibrary">
        <wa-icon slot="prefix" name="list-check"></wa-icon> Auswählen
      </wa-button>
      <wa-button size="small" @click.prevent="openCreate">
        <wa-icon slot="prefix" name="plus-lg"></wa-icon> Neu anlegen
      </wa-button>
    </div>

    <!-- Library Dialog -->
    <wa-dialog :open="showLibrary ? true : undefined" @wa-after-hide="showLibrary = false" label="Zusatzoptionen auswählen" style="--width: 600px;">
      <div class="library-content">
        <input
          v-model="librarySearch"
          type="text"
          class="library-search"
          placeholder="Suchen …"
        />
        <div class="library-list" v-if="filteredLibraryItems.length">
          <div
            v-for="item in filteredLibraryItems"
            :key="item.slug"
            :class="['library-item', { selected: isSelected(item.slug) }]"
            @click="toggleLibraryItem(item.slug)"
          >
            <span class="library-item-check">{{ isSelected(item.slug) ? '☑' : '☐' }}</span>
            <div class="library-item-info">
              <span class="library-item-name">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <p v-else-if="!libraryLoading" class="addon-empty">
          {{ librarySearch ? 'Keine Treffer.' : 'Noch keine Zusatzoptionen für dieses Projekt vorhanden.' }}
        </p>
        <p v-if="libraryLoading" class="addon-empty">Wird geladen …</p>
      </div>
      <div slot="footer">
        <wa-button @click="showLibrary = false">Schließen</wa-button>
      </div>
    </wa-dialog>

    <!-- Create Dialog -->
    <wa-dialog :open="showCreate ? true : undefined" @wa-after-hide="showCreate = false" label="Neue Zusatzoption anlegen">
      <div class="create-content">
        <wa-input
          label="Name"
          required
          :value="createData.name"
          @input="createData.name = $event.target.value"
        ></wa-input>
        <wa-input
          label="Beschreibung"
          :value="createData.description"
          @input="createData.description = $event.target.value"
        ></wa-input>
      </div>
      <div slot="footer" class="dialog-footer">
        <wa-button @click="showCreate = false">Abbrechen</wa-button>
        <wa-button variant="primary" @click="submitCreate" :loading="creating ? true : undefined">
          Anlegen & Zuweisen
        </wa-button>
      </div>
    </wa-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue';
import { api } from '../../services/api.js';
import { toast } from '../../composables/useToast.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:modelValue']);

// All addons for the current project (loaded from API)
const allAddons = ref([]);
const libraryLoading = ref(false);
const librarySearch = ref('');

// Dialogs
const showLibrary = ref(false);
const showCreate = ref(false);
const creating = ref(false);
const createData = ref({ name: '', description: '' });

// Resolve current project slug from the form context
const projectSlug = computed(() => {
  return props.context?.project || '';
});

// Resolve addon slugs to full objects
const resolvedAddons = computed(() => {
  if (!Array.isArray(props.modelValue)) return [];
  return props.modelValue
    .map(slug => allAddons.value.find(a => a.slug === slug))
    .filter(Boolean);
});

const isSelected = (slug) => {
  return Array.isArray(props.modelValue) && props.modelValue.includes(slug);
};

const filteredLibraryItems = computed(() => {
  const q = librarySearch.value.toLowerCase().trim();
  if (!q) return allAddons.value;
  return allAddons.value.filter(a =>
    a.name.toLowerCase().includes(q) ||
    (a.description || '').toLowerCase().includes(q)
  );
});

// Load all addons for the project
const loadAddons = async () => {
  if (!projectSlug.value) {
    allAddons.value = [];
    return;
  }
  libraryLoading.value = true;
  try {
    const data = await api.get(`/addons?project=${projectSlug.value}`);
    allAddons.value = Array.isArray(data) ? data : (data.items || []);
  } catch (err) {
    console.error('Failed to load addons:', err);
  } finally {
    libraryLoading.value = false;
  }
};

// Reload when project changes
watch(projectSlug, () => {
  loadAddons();
}, { immediate: true });

// Toggle addon selection
const toggleLibraryItem = (slug) => {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const idx = current.indexOf(slug);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(slug);
  }
  emit('update:modelValue', current);
};

const removeAddon = (slug) => {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const idx = current.indexOf(slug);
  if (idx >= 0) {
    current.splice(idx, 1);
    emit('update:modelValue', current);
  }
};

// Library dialog
const openLibrary = async () => {
  librarySearch.value = '';
  showLibrary.value = true;
  await loadAddons();
};

// Create dialog
const openCreate = () => {
  createData.value = { name: '', description: '' };
  showCreate.value = true;
};

const submitCreate = async () => {
  if (!createData.value.name.trim()) {
    toast.warning('Bitte gib einen Namen ein.');
    return;
  }
  if (!projectSlug.value) {
    toast.warning('Bitte wähle zuerst ein Projekt.');
    return;
  }

  creating.value = true;
  try {
    const result = await api.post('/addons', {
      name: createData.value.name.trim(),
      description: createData.value.description.trim(),
      project: projectSlug.value
    });

    // Add to local list and select it
    allAddons.value.push(result);
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    if (result.slug && !current.includes(result.slug)) {
      current.push(result.slug);
      emit('update:modelValue', current);
    }
    showCreate.value = false;
    toast.success(`Zusatzoption „${result.name}" angelegt.`);
  } catch (err) {
    toast.error('Fehler: ' + err.message);
  } finally {
    creating.value = false;
  }
};
</script>

<style scoped>
.addon-selector {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  background: var(--color-surface);
}

.addon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.addon-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem 0.3rem 0.75rem;
  background: var(--color-primary-50, rgba(46, 86, 65, 0.08));
  border: 1px solid rgba(46, 86, 65, 0.2);
  border-radius: 999px;
  font-size: var(--text-sm);
  color: var(--color-primary-dark);
  line-height: 1.4;
}

.addon-chip-name {
  font-weight: 600;
}

.addon-chip-desc {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.addon-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background 0.15s;
  flex-shrink: 0;
}
.addon-chip-remove:hover {
  background: rgba(220, 53, 69, 0.25);
}

.addon-empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0 0 0.75rem;
}

.addon-actions {
  display: flex;
  gap: 0.5rem;
}

/* Library dialog */
.library-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.library-search {
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
.library-search:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(46, 86, 65, 0.15);
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.library-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-light, var(--color-border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
  background: var(--color-surface);
}
.library-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-50, rgba(46, 86, 65, 0.04));
}
.library-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-50, rgba(46, 86, 65, 0.08));
}

.library-item-check {
  font-size: 1.1rem;
  flex-shrink: 0;
  color: var(--color-primary);
}

.library-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.library-item-name {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-dark);
}

.library-item-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* Create dialog */
.create-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
