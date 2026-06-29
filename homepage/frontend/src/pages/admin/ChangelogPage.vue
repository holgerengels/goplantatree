<template>
  <AdminLayout>
    <div class="changelog-page">
      <div class="changelog-header">
        <div class="changelog-title">
          <component :is="icons.History" class="title-icon" />
          <div>
            <h1>Änderungslog</h1>
            <span class="changelog-count">{{ total }} Einträge</span>
          </div>
        </div>
      </div>

      <!-- DETAIL VIEW -->
      <div v-if="selectedEntry" class="changelog-detail card">
        <div class="detail-header">
          <button class="btn-back" @click="selectedEntry = null" title="Zurück zur Liste">
            <component :is="icons.ArrowLeft" :size="20" />
          </button>
          <h2>Änderung</h2>
          <router-link v-if="objectLink" :to="objectLink" class="object-link">
            <component :is="icons.ExternalLink" :size="14" />
            Zum Objekt
          </router-link>
        </div>

        <div class="detail-meta">
          <div class="meta-row">
            <span class="meta-label">Zeitpunkt</span>
            <span class="meta-value">{{ formatDateTime(selectedEntry.timestamp) }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Benutzer</span>
            <span class="meta-value">{{ selectedEntry.user }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Ressource</span>
            <span class="meta-value">{{ selectedEntry.resource }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Aktion</span>
            <span :class="['action-badge', selectedEntry.action]">{{ actionLabel(selectedEntry.action) }}</span>
          </div>
          <div class="meta-row" v-if="selectedEntry.documentSlug">
            <span class="meta-label">Bezeichnung</span>
            <span class="meta-value">{{ selectedEntry.documentSlug }}</span>
          </div>
        </div>

        <!-- Diff for updates -->
        <div v-if="selectedEntry.action === 'update' && selectedEntry.diff" class="detail-section">
          <h3>Änderungen</h3>
          <table class="diff-table">
            <thead>
              <tr>
                <th>Feld</th>
                <th>Vorher</th>
                <th>Nachher</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(change, field) in selectedEntry.diff" :key="field">
                <td class="diff-field">{{ field }}</td>
                <td class="diff-from">{{ formatValue(change.from) }}</td>
                <td class="diff-to">{{ formatValue(change.to) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Snapshot for create -->
        <div v-if="selectedEntry.action === 'create'" class="detail-section">
          <h3>Erstellte Daten</h3>
          <div v-if="detailLoading" class="detail-loading">Wird geladen…</div>
          <table v-else-if="detailSnapshot" class="snapshot-table">
            <tbody>
              <tr v-for="(value, key) in filteredSnapshot(detailSnapshot)" :key="key">
                <td class="snapshot-key">{{ key }}</td>
                <td class="snapshot-value">{{ formatValue(value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Snapshot for delete -->
        <div v-if="selectedEntry.action === 'delete'" class="detail-section">
          <h3>Gelöschte Daten</h3>
          <div v-if="detailLoading" class="detail-loading">Wird geladen…</div>
          <table v-else-if="detailSnapshot" class="snapshot-table">
            <tbody>
              <tr v-for="(value, key) in filteredSnapshot(detailSnapshot)" :key="key">
                <td class="snapshot-key">{{ key }}</td>
                <td class="snapshot-value">{{ formatValue(value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- LIST VIEW -->
      <div v-else class="changelog-list card">
        <div class="list-toolbar">
          <select v-model="filterResource" class="form-select generic-filter">
            <option :value="undefined">Ressource: alle</option>
            <option v-for="r in resourceOptions" :key="r" :value="r">{{ r }}</option>
          </select>
          <select v-model="filterAction" class="form-select generic-filter">
            <option :value="undefined">Aktion: alle</option>
            <option value="create">Erstellt</option>
            <option value="update">Geändert</option>
            <option value="delete">Gelöscht</option>
          </select>
        </div>

        <div class="table-responsive" v-if="items.length">
          <table class="data-table">
            <thead>
              <tr>
                <th @click="toggleSort('timestamp')" class="sortable">
                  Zeitpunkt
                  <span v-if="sortField === 'timestamp'" class="sort-indicator">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th @click="toggleSort('user')" class="sortable">
                  Benutzer
                  <span v-if="sortField === 'user'" class="sort-indicator">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th @click="toggleSort('resource')" class="sortable">
                  Ressource
                  <span v-if="sortField === 'resource'" class="sort-indicator">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th>Aktion</th>
                <th>Bezeichnung</th>
                <th>Zusammenfassung</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item._id" @click="showDetail(item)">
                <td>{{ formatDateTime(item.timestamp) }}</td>
                <td>{{ item.user }}</td>
                <td>{{ item.resource }}</td>
                <td><span :class="['action-badge', item.action]">{{ actionLabel(item.action) }}</span></td>
                <td class="cell-text">{{ item.documentSlug || '–' }}</td>
                <td class="cell-text diff-summary">{{ diffSummary(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="muted">Keine Einträge gefunden.</p>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button class="pagination-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
            <component :is="icons.ChevronLeft" :size="16" />
          </button>
          <span class="pagination-info">Seite {{ currentPage }} von {{ totalPages }}</span>
          <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
            <component :is="icons.ChevronRight" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as icons from 'lucide-vue-next';
import AdminLayout from '../../components/admin/AdminLayout.vue';
import { useConfigStore } from '../../stores/config.js';
import { api } from '../../services/api.js';

const configStore = useConfigStore();

const items = ref([]);
const total = ref(0);
const selectedEntry = ref(null);
const detailSnapshot = ref(null);
const detailLoading = ref(false);

const filterResource = ref(undefined);
const filterAction = ref(undefined);
const resourceOptions = ref([]);

const sortField = ref('timestamp');
const sortAsc = ref(false);

const pageSize = 100;
const currentPage = ref(1);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const actionLabel = (action) => {
  const labels = { create: 'Erstellt', update: 'Geändert', delete: 'Gelöscht' };
  return labels[action] || action;
};

/**
 * Build admin link to the referenced object (only for non-delete actions).
 */
const objectLink = computed(() => {
  const entry = selectedEntry.value;
  if (!entry || entry.action === 'delete') return null;
  const entity = configStore.entities.find(e => e.resource === entry.resource);
  if (!entity) return null;
  return `/admin/${entity.slug}`;
});

const formatDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatValue = (val) => {
  if (val === null || val === undefined) return '–';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  return String(val);
};

const HIDDEN_KEYS = ['_id', '__v', 'createdAt', 'updatedAt'];

const filteredSnapshot = (snapshot) => {
  if (!snapshot) return {};
  const result = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!HIDDEN_KEYS.includes(key)) {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Build a short summary string from the diff object.
 */
const diffSummary = (item) => {
  if (item.action === 'create') return 'Neu erstellt';
  if (item.action === 'delete') return 'Gelöscht';
  if (!item.diff) return '–';
  const fields = Object.keys(item.diff);
  if (fields.length <= 3) return fields.join(', ');
  return `${fields.slice(0, 3).join(', ')} (+${fields.length - 3})`;
};

const toggleSort = (field) => {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortField.value = field;
    sortAsc.value = true;
  }
  currentPage.value = 1;
  loadData();
};

const goToPage = (page) => {
  currentPage.value = page;
  loadData();
};

const loadData = async () => {
  try {
    const params = new URLSearchParams();
    params.append('limit', pageSize);
    params.append('skip', (currentPage.value - 1) * pageSize);

    if (filterResource.value) params.append('resource', filterResource.value);
    if (filterAction.value) params.append('action', filterAction.value);

    const data = await api.get(`/changelog?${params.toString()}`);
    items.value = data.items || [];
    total.value = data.total || 0;
  } catch (err) {
    console.error('Changelog load error:', err);
  }
};

const loadResourceOptions = async () => {
  try {
    const data = await api.get('/changelog/distinct/resource');
    resourceOptions.value = data;
  } catch {
    // Fallback: extract from loaded items
  }
};

const showDetail = async (item) => {
  selectedEntry.value = item;
  detailSnapshot.value = null;

  // For create/delete, lazy-load the full entry with before/after
  if (item.action === 'create' || item.action === 'delete') {
    detailLoading.value = true;
    try {
      const entries = await api.get(`/changelog/${item.documentId}`);
      const fullEntry = Array.isArray(entries)
        ? entries.find(e => e._id === item._id)
        : entries;
      if (fullEntry) {
        detailSnapshot.value = item.action === 'create' ? fullEntry.after : fullEntry.before;
      }
    } catch (err) {
      console.error('Detail load error:', err);
    } finally {
      detailLoading.value = false;
    }
  }
};

watch([filterResource, filterAction], () => {
  currentPage.value = 1;
  loadData();
});

onMounted(() => {
  loadData();
  loadResourceOptions();
});
</script>

<style scoped>
.changelog-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.changelog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.changelog-title {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.title-icon {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
}

.changelog-title h1 {
  font-size: var(--text-2xl);
  margin: 0;
}

.changelog-count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* List toolbar */
.list-toolbar {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

/* Table */
.table-responsive {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-summary {
  color: var(--color-text-muted);
  font-style: italic;
}

/* Action badges */
.action-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.action-badge.create {
  background: var(--color-success-bg, #e6f9e6);
  color: var(--color-success, #2e7d32);
}

.action-badge.update {
  background: var(--color-primary-50, #e3f2fd);
  color: var(--color-primary, #1565c0);
}

.action-badge.delete {
  background: var(--color-error-bg, #fce4ec);
  color: var(--color-error, #c62828);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-lg) 0 var(--space-sm);
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-alt);
  color: var(--color-text);
  border-color: var(--color-border);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-info {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  padding: var(--space-lg);
  text-align: center;
}

/* Detail view */
.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.detail-header h2 {
  margin: 0;
  flex: 1;
}

.object-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: var(--color-primary-50);
  color: var(--color-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  text-decoration: none;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.object-link:hover {
  background: var(--color-primary-100);
  color: var(--color-primary-dark);
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

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-sm) var(--space-xl);
  padding: var(--space-lg);
  background: var(--color-bg-alt);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-xl);
}

.meta-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.meta-value {
  font-size: var(--text-sm);
  color: var(--color-text);
}

.detail-section {
  margin-top: var(--space-lg);
}

.detail-section h3 {
  font-size: var(--text-base);
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.detail-loading {
  padding: var(--space-lg);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* Diff table */
.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.diff-table th {
  text-align: left;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: var(--space-sm);
  border-bottom: 2px solid var(--color-border-light);
}

.diff-table td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top;
}

.diff-field {
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  width: 160px;
}

.diff-from {
  background: var(--color-error-bg, #fce4ec);
  color: var(--color-error, #c62828);
  word-break: break-word;
  max-width: 300px;
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
}

.diff-to {
  background: var(--color-success-bg, #e6f9e6);
  color: var(--color-success, #2e7d32);
  word-break: break-word;
  max-width: 300px;
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
}

/* Snapshot table */
.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.snapshot-table td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top;
}

.snapshot-key {
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  width: 160px;
}

.snapshot-value {
  word-break: break-word;
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
