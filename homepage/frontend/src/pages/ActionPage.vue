<template>
  <div class="action-page page-container">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Aktion wird geladen …</p>
    </div>
    
    <div v-else-if="error" class="error-state card">
      <h2>Fehler</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">Zurück zur Startseite</router-link>
    </div>
    
    <div v-else-if="project" class="action-content">
      <div class="card">
        <h2>{{ project.name }} - Aktion in Vorbereitung</h2>
        <p>Diese Aktion ("{{ actionType }}") befindet sich aktuell in Vorbereitung.</p>
        <p v-if="project.text" class="project-text">{{ project.text }}</p>
        <router-link :to="`/projekt/${project.slug}`" class="btn btn-outline">Zurück zum Projekt</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../services/api.js';
import { useHead } from '../composables/useHead.js';

const route = useRoute();
const project = ref(null);
const loading = ref(true);
const error = ref('');

const actionType = computed(() => route.path.split('/')[1]);

useHead(() => {
    if (!project.value) return { title: 'Aktion wird geladen…' };
    return {
        title: `Aktion: ${project.value.name}`,
        description: project.value.text,
    };
});

onMounted(async () => {
    const slug = route.params.projectSlug;
    if (!slug) {
        error.value = 'Kein Projekt angegeben.';
        loading.value = false;
        return;
    }

    try {
        const p = await api.get(`/projects/${slug}`);
        if (!p || !p.active) {
            error.value = 'Dieses Projekt ist aktuell nicht verfügbar.';
        } else {
            project.value = p;
        }
    } catch (err) {
        error.value = 'Das Projekt konnte nicht geladen werden.';
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-xl) var(--space-md);
}

.loading-state {
    text-align: center;
    padding: var(--space-2xl) 0;
    color: var(--color-text-muted);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto var(--space-md);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-state {
    text-align: center;
    padding: var(--space-2xl);
}

.error-state h2 {
    color: var(--color-error);
    margin-top: 0;
}

.project-text {
    margin: var(--space-md) 0;
    padding: var(--space-md);
    background: var(--color-surface-hover);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
}

.action-content {
    animation: fadeIn var(--transition-normal) ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
