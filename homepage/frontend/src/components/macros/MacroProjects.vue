<template>
  <div :class="['macro-projects', theme ? `section-${theme}` : '']">
    <div class="section-title" v-if="title || subtitle">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>

    <div class="projects-grid" v-if="loadedProjects.length">
      <router-link
        v-for="project in loadedProjects"
        :key="project._id"
        :to="`/projekt/${project.slug}`"
        class="project-card card"
      >
        <div class="project-card-header">
          <h3>{{ project.name }}</h3>
          <span v-if="project.active" class="badge badge-success">Aktiv</span>
        </div>
        <p>{{ project.text }}</p>
        <div class="project-card-meta" v-if="project.orderPeriod">
          <span class="meta-date">
            📅 {{ formatDate(project.orderPeriod.start) }} – {{ formatDate(project.orderPeriod.end) }}
          </span>
        </div>
        <div class="project-card-footer">
          <span class="btn btn-primary btn-sm">Mehr erfahren →</span>
        </div>
      </router-link>
    </div>
    <div v-else-if="loading" class="loading-projects">
      Wird geladen...
    </div>
    <div v-else class="no-projects">
      Keine Projekte gefunden.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useProjectsStore } from '../../stores/projects.js';
import { formatDateLong as formatDate } from '../../utils/format.js';

const props = defineProps({
    limit: {
        type: Number,
        default: 3
    },
    activeOnly: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: ''
    },
    subtitle: {
        type: String,
        default: ''
    },
    theme: {
        type: String,
        default: '' // e.g. 'alt', 'surface', 'primary'
    }
});

const projectsStore = useProjectsStore();
const loading = ref(true);

onMounted(async () => {
    await projectsStore.fetchProjects();
    loading.value = false;
});

const loadedProjects = computed(() => {
    let list = projectsStore.projects;
    if (props.activeOnly) {
        list = list.filter(p => p.active);
    }
    return list.slice(0, props.limit);
});
</script>

<style scoped>
.macro-projects {
    width: 100%;
}

.projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-xl);
}

.project-card {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
}
.project-card:hover {
    transform: translateY(-4px);
}
.project-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-md);
}
.project-card-header h3 {
    margin: 0;
}
.project-card-meta {
    margin-top: auto;
    padding-top: var(--space-md);
}
.meta-date {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
}
.project-card-footer {
    margin-top: var(--space-lg);
}

.loading-projects, .no-projects {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--space-xl);
}
</style>
