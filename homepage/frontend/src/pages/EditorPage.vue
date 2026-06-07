<template>
  <div class="editor-page" v-if="config">
    <div class="editor-header">
      <div class="editor-title">
        <span class="editor-icon">
          <component :is="icons[config.icon]" v-if="icons[config.icon]" />
          <span v-else>{{ config.icon }}</span>
        </span>
        <div>
          <h1>{{ config.label.plural }}</h1>
          <span class="editor-count">{{ items.length }} Einträge</span>
        </div>
      </div>

      <div class="editor-actions">
        <wa-button v-if="!editing" variant="default" @click="triggerExport('csv')" :disabled="!items.length || exporting ? true : undefined">
          <wa-icon name="download" slot="prefix"></wa-icon> CSV Export
        </wa-button>
        <wa-button v-if="!editing" variant="default" @click="triggerExport('ods')" :disabled="!items.length || exporting ? true : undefined">
          <wa-icon name="download" slot="prefix"></wa-icon> ODS Export
        </wa-button>
        <wa-button v-if="!editing && auth.hasPermission(resourceName, 'create')" variant="primary" @click="startCreate">
          <wa-icon name="plus" slot="prefix"></wa-icon> Neu
        </wa-button>
      </div>
    </div>

    <!-- FORM VIEW -->
    <div v-if="editing" class="editor-form card">
      <div class="form-header">
        <button class="btn-back" @click="cancelEdit" title="Zurück zur Liste">
          <component :is="icons.ArrowLeft" :size="20" />
        </button>
        <h2>{{ editingId ? 'Bearbeiten' : 'Neu anlegen' }}</h2>
      </div>
      <DynamicForm
        ref="formRef"
        :fields="config.fields || []"
        :grid="config.grid || []"
        :resource="resourceName"
        :action="editingId ? 'update' : 'create'"
        v-model="formData"
      />
      <div class="form-actions">
        <div class="form-actions-left">
          <wa-button v-if="editingId ? auth.hasItemPermission(resourceName, 'update', formData) : auth.hasPermission(resourceName, 'create')" variant="primary" @click="save" :disabled="saving ? true : undefined" :loading="saving ? true : undefined">
            <wa-icon name="check" slot="prefix"></wa-icon> Speichern
          </wa-button>
          <wa-button variant="default" @click="cancelEdit">
            Abbrechen
          </wa-button>
        </div>
        <wa-button v-if="editingId && auth.hasItemPermission(resourceName, 'delete', formData)" variant="danger" @click="remove">
          <wa-icon name="trash" slot="prefix"></wa-icon> Löschen
        </wa-button>
      </div>
    </div>

    <!-- LIST VIEW -->
    <div v-else class="editor-list card">
      <!-- Search and Filter -->
      <div class="list-toolbar">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input search-input"
          :placeholder="`${config.label.plural} suchen …`"
        />


        <!-- Generic Filters -->
        <template v-if="config.admin?.filters">
          <select 
            v-for="filterKey in config.admin.filters" 
            :key="filterKey" 
            v-model="activeFilters[filterKey]" 
            class="form-select generic-filter"
          >
            <option :value="undefined">{{ getFilterLabel(filterKey) }}: alle</option>
            <option v-for="opt in getFilterOptions(filterKey)" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </template>
      </div>

      <!-- Grid View -->
      <div class="data-grid" v-if="filteredItems.length && config.admin?.viewType === 'grid'">
        <div class="grid-card" v-for="item in filteredItems" :key="item._id" @dblclick="startEdit(item)">
          <div class="grid-image-wrapper">
            <video v-if="item.mimeType?.startsWith('video/')" :src="item.url || item.file" muted loop playsinline preload="none"></video>
            <img v-else-if="item.url || item.file" :src="item.url || item.file" loading="lazy" />
            <div v-else class="grid-placeholder">Kein Bild</div>
          </div>
          <div class="grid-card-content">
            <div class="grid-card-info">
              <h4>{{ item.title || item.name || 'Ohne Titel' }}</h4>
              <span v-if="config.entity === 'media'" class="macro-copy" @click.stop="copyMacro(item.slug || item._id, $event)" title="Makro in die Zwischenablage kopieren">
                <component :is="icons.Clipboard" :size="14" /> Makro kopieren
              </span>
            </div>
            <div class="grid-actions">
              <button v-if="config.admin?.allowCopy && auth.hasPermission(resourceName, 'create')" class="btn-icon" @click="startCopy(item)" title="Kopieren">
                <component :is="icons.Copy" />
              </button>
              <button v-if="auth.hasItemPermission(resourceName, 'update', item)" class="btn-icon" @click="startEdit(item)" title="Bearbeiten">
                <component :is="icons.Edit2" />
              </button>
              <button v-else class="btn-icon" @click="startEdit(item)" title="Ansehen">
                <component :is="icons.Eye" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Table View -->
      <table class="data-table" v-else-if="filteredItems.length">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" @click="toggleSort(col.key)" class="sortable">
              {{ col.label }}
              <span v-if="sortField === col.key" class="sort-indicator">{{ sortAsc ? '▲' : '▼' }}</span>
            </th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredItems" :key="item._id" @dblclick="startEdit(item)">
            <td v-for="col in columns" :key="col.key">
              <span v-if="col.type === 'boolean'" :class="['bool-dot', getVal(item, col.key) ? 'yes' : 'no']">
                {{ getVal(item, col.key) ? '✓' : '✗' }}
              </span>
              <span v-else-if="col.type === 'date'">{{ formatDate(getVal(item, col.key)) }}</span>
              <div v-else-if="col.type === 'image'" class="thumb-wrapper">
                <video v-if="item.mimeType?.startsWith('video/')" :src="getVal(item, col.key)" class="admin-thumb" muted loop playsinline preload="none"></video>
                <img v-else :src="getVal(item, col.key)" class="admin-thumb" loading="lazy" />
              </div>
              <span v-else class="cell-text">{{ getVal(item, col.key) ?? '–' }}</span>
            </td>
            <td class="col-actions">
              <button v-if="config.admin?.allowCopy && auth.hasPermission(resourceName, 'create')" class="btn-icon" @click="startCopy(item)" title="Kopieren">
                <component :is="icons.Copy" />
              </button>
              <button v-if="auth.hasItemPermission(resourceName, 'update', item)" class="btn-icon" @click="startEdit(item)" title="Bearbeiten">
                <component :is="icons.Edit2" />
              </button>
              <button v-else class="btn-icon" @click="startEdit(item)" title="Ansehen">
                <component :is="icons.Eye" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">
        {{ searchQuery ? 'Keine Treffer.' : `Noch keine ${config.label.plural} vorhanden.` }}
      </p>
    </div>
  </div>
  <div v-else class="loading"><p>Wird geladen…</p></div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, provide } from 'vue';
import { useRoute } from 'vue-router';
import * as icons from 'lucide-vue-next';
import DynamicForm from '../components/forms/DynamicForm.vue';
import { useConfigStore } from '../stores/config.js';
import { useAuthStore } from '../stores/auth.js';
import { useProjectsStore } from '../stores/projects.js';
import { formatDate } from '../utils/format.js';
import { api } from '../services/api.js';

const route = useRoute();
const configStore = useConfigStore();
const auth = useAuthStore();
const projectsStore = useProjectsStore();

const config = ref(null);
const items = ref([]);
const editing = ref(false);
const editingId = ref(null);
const formData = reactive({});
const formRef = ref(null);
const saving = ref(false);
const searchQuery = ref('');
const activeFilters = reactive({});
const sortField = ref(null);
const sortAsc = ref(true);
const currentEntityInfo = ref(null);

const resourceName = computed(() => {
    return config.value?.resource || currentEntityInfo.value?.resource || '';
});


const columns = computed(() => config.value?.admin?.columns || []);

const getFilterOptions = (key) => {
    if (key === 'project') {
        return projectsStore.projects.map(p => ({ label: p.name, value: p.slug }));
    }

    if (!config.value || !config.value.fields) return [];
    
    // First try to find options in field config
    const fieldDef = config.value.fields.find(f => f.name === key);
    if (fieldDef && fieldDef.options && Array.isArray(fieldDef.options)) {
        return fieldDef.options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt);
    }
    
    // Fallback: extract unique values from current items
    const uniqueValues = new Set();
    items.value.forEach(item => {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
            uniqueValues.add(item[key]);
        }
    });
    return Array.from(uniqueValues).sort().map(val => ({ label: val, value: val }));
};

const getFilterLabel = (key) => {
    if (!config.value || !config.value.fields) return key;
    const fieldDef = config.value.fields.find(f => f.name === key);
    return fieldDef ? fieldDef.label : key;
};

// Dot-notation access for column keys like 'project.slug'
const getVal = (item, key) => {
    if (!key.includes('.')) return item[key];
    return key.split('.').reduce((obj, k) => obj?.[k], item);
};

// Search + sort
const filteredItems = computed(() => {
    let result = [...items.value];

    // Search
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(item =>
            columns.value.some(col => {
                const val = getVal(item, col.key);
                return val && String(val).toLowerCase().includes(q);
            })
        );
    }

    // Sort
    if (sortField.value) {
        result.sort((a, b) => {
            const va = a[sortField.value] ?? '';
            const vb = b[sortField.value] ?? '';
            const cmp = String(va).localeCompare(String(vb), 'de', { numeric: true });
            return sortAsc.value ? cmp : -cmp;
        });
    }

    return result;
});

const toggleSort = (key) => {
    if (sortField.value === key) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortField.value = key;
        sortAsc.value = true;
    }
};



// CRUD operations
const startCreate = () => {
    editing.value = true;
    editingId.value = null;
    Object.keys(formData).forEach(k => delete formData[k]);
    
    // Prefill project if create permission is scoped to 'own'
    const resPerms = auth.permissions[resourceName.value] || {};
    if (resPerms.create === 'own' && auth.user?.project) {
        formData.project = auth.user.project;
    }
};

const startEdit = (item) => {
    editing.value = true;
    editingId.value = item._id;
    Object.keys(formData).forEach(k => delete formData[k]);
    Object.assign(formData, JSON.parse(JSON.stringify(item)));
};

const startCopy = (item) => {
    editing.value = true;
    editingId.value = null;
    Object.keys(formData).forEach(k => delete formData[k]);
    
    const copied = JSON.parse(JSON.stringify(item));
    delete copied._id;
    delete copied.id;
    delete copied.createdAt;
    delete copied.updatedAt;
    delete copied.__v;
    
    if (copied.name) copied.name = `${copied.name} (Kopie)`;
    if (copied.title) copied.title = `${copied.title} (Kopie)`;
    if (copied.slug) copied.slug = `${copied.slug}-kopie`;
    
    Object.assign(formData, copied);
};

const cancelEdit = () => {
    editing.value = false;
    editingId.value = null;
};

const save = async () => {
    if (formRef.value && !formRef.value.validate()) return;
    saving.value = true;
    try {
        const endpoint = config.value.api.replace('/api/v1', '');
        const url = editingId.value
            ? `${endpoint}/${editingId.value}`
            : endpoint;
        const method = editingId.value ? 'put' : 'post';
        
        // Check if there is a File object in formData (needs FormData/multipart)
        const hasFile = Object.values(formData).some(val => val instanceof File);
        
        if (hasFile) {
            const body = new FormData();
            Object.entries(formData).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    body.append(k, v);
                }
            });
            await api.upload(url, body, method.toUpperCase());
        } else {
            await api[method](url, formData);
        }

        cancelEdit();
        await loadData();
    } catch (err) {
        alert('Fehler: ' + err.message);
    } finally {
        saving.value = false;
    }
};

const remove = async () => {
    if (!confirm(`${config.value.label.singular} wirklich löschen?`)) return;
    try {
        const endpoint = config.value.api.replace('/api/v1', '');
        await api.delete(`${endpoint}/${editingId.value}`);
        cancelEdit();
        await loadData();
    } catch (err) {
        // Handle 409 Conflict — object is still referenced
        if (err.message?.includes('referenziert')) {
            const forceDelete = confirm(
                `${err.message}\n\nTrotzdem löschen? Referenzierende Einträge werden dadurch ungültige Verweise enthalten.`
            );
            if (forceDelete) {
                try {
                    const endpoint = config.value.api.replace('/api/v1', '');
                    await api.delete(`${endpoint}/${editingId.value}?force=true`);
                    cancelEdit();
                    await loadData();
                } catch (err2) {
                    alert('Fehler: ' + err2.message);
                }
            }
        } else {
            alert('Fehler: ' + err.message);
        }
    }
};

const copyMacro = async (id, event) => {
    try {
        await navigator.clipboard.writeText(`[[media id="${id}"]]`);
        const el = event.currentTarget;
        const originalHtml = el.innerHTML;
        el.innerHTML = '✓ Kopiert!';
        el.style.color = 'var(--color-success)';
        setTimeout(() => {
            el.innerHTML = originalHtml;
            el.style.color = '';
        }, 2000);
    } catch (err) {
        console.error('Copy failed', err);
    }
};

// Data loading
const loadData = async () => {
    if (!config.value?.api) return;
    try {
        let endpoint = config.value.api.replace('/api/v1', '');
        const queryParams = new URLSearchParams();
        
        if (config.value.admin?.filters) {
            for (const f of config.value.admin.filters) {
                if (activeFilters[f] !== undefined && activeFilters[f] !== '') {
                    queryParams.append(f, activeFilters[f]);
                }
            }
        }
        
        const qs = queryParams.toString();
        if (qs) endpoint += `?${qs}`;
        
        const data = await api.get(endpoint);
        items.value = Array.isArray(data) ? data : (data.items || data.orders || Object.values(data).find(v => Array.isArray(v)) || []);
    } catch (err) {
        console.error('Load error:', err);
    }
};

const exporting = ref(false);

const triggerExport = async (format) => {
    if (exporting.value) return;
    exporting.value = true;
    try {
        let endpoint = config.value.api.replace('/api/v1', '') + '/export';
        const queryParams = new URLSearchParams();
        queryParams.append('format', format);
        
        if (config.value.admin?.filters) {
            for (const f of config.value.admin.filters) {
                if (activeFilters[f] !== undefined && activeFilters[f] !== '') {
                    queryParams.append(f, activeFilters[f]);
                }
            }
        }
        
        if (searchQuery.value) {
            queryParams.append('search', searchQuery.value);
        }
        
        const qs = queryParams.toString();
        if (qs) endpoint += `?${qs}`;
        
        const blob = await api.download(endpoint);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${config.value.entity}_export.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export-Fehler: ' + err.message);
    } finally {
        exporting.value = false;
    }
};



watch(activeFilters, () => {
    if (config.value) loadData();
}, { deep: true });

const loadConfig = async () => {
    const slug = route.params.entity;
    await configStore.fetchEntities();
    const entityInfo = configStore.findBySlug(slug);
    currentEntityInfo.value = entityInfo || null;
    if (entityInfo) {
        config.value = await configStore.fetchConfig(entityInfo.configName);
        if (config.value.admin?.filters?.includes('project')) {
            await projectsStore.fetchProjects(); // Ensure projects are loaded
        }
        await loadData(); // Load table data immediately
    }
};

onMounted(loadConfig);

watch(() => route.params.entity, async () => {
    config.value = null;
    items.value = [];
    editing.value = false;
    searchQuery.value = '';
    Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
    await loadConfig();
});
</script>

<style scoped>
.editor-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.editor-title {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.editor-icon {
    font-size: 2rem;
}

.editor-title h1 {
    font-size: var(--text-2xl);
    margin: 0;
}

.editor-count {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
}

/* Form view */
.form-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-xl);
}

.form-header h2 {
    margin: 0;
}

.btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
}
.btn-back:hover {
    background: var(--color-bg-alt);
    color: var(--color-text);
    border-color: var(--color-border);
}

.form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-xl);
}

.form-actions-left {
    display: flex;
    gap: var(--space-md);
}

.btn-danger {
    color: var(--color-error) !important;
}

/* List view */
.list-toolbar {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
}

.search-input {
    flex-grow: 1;
    max-width: 400px;
}


.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th {
    text-align: left;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    padding: var(--space-sm);
    border-bottom: 2px solid var(--color-border-light);
    user-select: none;
}

.data-table th.sortable {
    cursor: pointer;
}
.data-table th.sortable:hover {
    color: var(--color-primary);
}

.sort-indicator {
    font-size: var(--text-xs);
    margin-left: 4px;
}

.data-table td {
    padding: var(--space-sm);
    border-bottom: 1px solid var(--color-border-light);
    font-size: var(--text-sm);
}

.data-table tr {
    cursor: pointer;
}
.data-table tr:hover {
    background: var(--color-primary-50);
}

.cell-text {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
}

.col-actions {
    width: 80px;
    text-align: center;
}

.bool-dot {
    font-weight: 600;
}
.bool-dot.yes { color: var(--color-success); }
.bool-dot.no { color: var(--color-text-muted); }

.btn-icon {
    cursor: pointer;
    font-size: var(--text-base);
    padding: var(--space-xs);
}

.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    padding: var(--space-lg);
    text-align: center;
}

.loading {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
}

.thumb-wrapper {
    width: 60px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-bg-alt);
    border: 1px solid var(--color-border-light);
}

.admin-thumb {
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
}

/* Grid View for Media */
.data-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-lg);
    padding: var(--space-sm) 0;
}

.grid-card {
    background: var(--color-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    cursor: pointer;
}
.grid-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.grid-image-wrapper {
    width: 100%;
    height: 150px;
    background: var(--color-bg-alt);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.grid-image-wrapper img, .grid-image-wrapper video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.grid-placeholder {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}

.grid-card-content {
    padding: var(--space-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.grid-card-content h4 {
    margin: 0;
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.grid-actions .btn-icon {
    padding: 4px;
}
.grid-actions .btn-icon svg {
    width: 16px;
    height: 16px;
}

.grid-card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
}

.macro-copy {
    font-size: 10px;
    color: var(--color-primary);
    background: var(--color-primary-50);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    white-space: nowrap;
    border: 1px solid var(--color-primary-100);
    transition: all var(--transition-fast);
}
.macro-copy:hover {
    background: var(--color-primary-100);
}
</style>
