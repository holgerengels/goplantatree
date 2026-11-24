<template>
  <div class="macro-project-selector" :class="`variant-${variant}`">
    <!-- Chips Layout (Default) -->
    <div v-if="variant === 'chips'" class="project-selector-chips">
      <span v-if="label" class="selector-label">{{ label }}</span>
      <div class="chips chips-container" role="group" :aria-label="label || 'Projekte filtern'">
        <button
          type="button"
          class="chip chip-item"
          :class="{ active: !selectedProject }"
          :aria-pressed="!selectedProject"
          @click="setValue('')"
        >
          {{ allLabel }}
        </button>
        <button
          v-for="p in availableProjects"
          :key="p.slug"
          type="button"
          class="chip chip-item"
          :class="{ active: selectedProject === p.slug }"
          :aria-pressed="selectedProject === p.slug"
          @click="toggleValue(p.slug)"
        >
          {{ p.name }}
        </button>
      </div>
    </div>

    <!-- Dropdown Layout -->
    <div v-else class="project-selector-dropdown">
      <label v-if="label" :for="selectId" class="selector-label">{{ label }}</label>
      <select
        :id="selectId"
        class="form-input selector-select"
        :value="selectedProject"
        @change="setValue($event.target.value)"
      >
        <option value="">{{ allLabel }}</option>
        <option v-for="p in availableProjects" :key="p.slug" :value="p.slug">
          {{ p.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useProjectsStore } from '../../stores/projects.js';
import { useQueryFilter } from '../../composables/useQueryFilter.js';

const props = defineProps({
    variant: {
        type: String,
        default: 'chips',
        validator: (v) => ['chips', 'select', 'dropdown'].includes(v)
    },
    allLabel: {
        type: String,
        default: 'Alle Projekte'
    },
    label: {
        type: String,
        default: ''
    },
    activeOnly: {
        type: Boolean,
        default: false
    },
    param: {
        type: String,
        default: 'project'
    }
});

const selectId = `project-select-${Math.random().toString(36).substring(2, 8)}`;
const projectsStore = useProjectsStore();
const { value: selectedProject, setValue, toggleValue } = useQueryFilter(props.param);

onMounted(() => {
    projectsStore.fetchProjects().catch(() => {});
});

const availableProjects = computed(() => {
    const list = projectsStore.projects || [];
    if (props.activeOnly) {
        return list.filter((p) => p.active !== false && p.status !== 'archived');
    }
    return list;
});
</script>

<style scoped>
.macro-project-selector {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    padding: var(--space-xs) 0;
}

.selector-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-right: var(--space-sm);
    white-space: nowrap;
}

.project-selector-chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
    width: 100%;
    min-width: 0;
}

/* Dropdown Style */
.project-selector-dropdown {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    max-width: 400px;
    width: 100%;
}

.selector-select {
    flex: 1;
    cursor: pointer;
}

@media (max-width: 768px) {
    .macro-project-selector {
        min-height: 46px;
    }

    .chips-container {
        padding-bottom: 0;
    }
}
</style>
