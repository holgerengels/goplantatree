<template>
  <div v-if="rows.length" class="macro-fields">
    <h3 v-if="title">{{ title }}</h3>
    <div class="fields-grid">
      <div v-for="row in rows" :key="row.key" class="field">
        <span class="field-label">{{ row.label }}</span>
        <span v-if="Array.isArray(row.value)" class="field-value field-tags">
          <span v-for="tag in row.value" :key="tag" class="field-tag">{{ tag }}</span>
        </span>
        <span v-else class="field-value">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { getPath, formatters } from '../../utils/fillTemplate.js';

/**
 * [[fields keys="height,width,location" title="Steckbrief"]]
 *
 * Shows label (from entity config) + value of the current detail item.
 * Empty fields are omitted. Only usable on entity detail pages (Page "detail-<entity>").
 * A key may carry a formatter: keys="publishedAt|date,author".
 */
const props = defineProps({
    keys: { type: String, required: true },
    title: { type: String, default: '' }
});

const ctx = inject('entityContext', null);

const isEmpty = (v) => v === undefined || v === null || v === ''
    || (Array.isArray(v) && v.length === 0);

const rows = computed(() => {
    const item = ctx?.value?.item;
    const fields = ctx?.value?.config?.fields || [];
    if (!item) return [];
    return props.keys.split(',').map(k => k.trim()).filter(Boolean).map(spec => {
        const [key, fmt] = spec.split('|').map(s => s.trim());
        let value = getPath(item, key);
        if (fmt && formatters[fmt]) value = formatters[fmt](value);
        const label = fields.find(f => f.name === key)?.label || key;
        return { key, label, value };
    }).filter(r => !isEmpty(r.value));
});
</script>

<style scoped>
.macro-fields { margin: var(--space-xl) 0; }
.macro-fields h3 { margin-bottom: var(--space-md); }

.fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
}

.field {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-alt);
    padding: var(--space-md);
    border-radius: var(--radius-md);
}

.field-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-xs);
}

.field-value {
    font-weight: 600;
    color: var(--color-primary-dark);
}

.field-tags { display: flex; flex-wrap: wrap; gap: 4px; }

.field-tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    background: var(--color-primary-50, rgba(46, 86, 65, 0.1));
    color: var(--color-primary-dark);
    font-size: var(--text-xs);
    font-weight: 500;
}
</style>
