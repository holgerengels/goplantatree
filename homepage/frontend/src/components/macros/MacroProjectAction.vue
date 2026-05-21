<template>
  <div class="macro-project-action" v-if="projectData">
    <router-link
      v-if="projectData.active && actionPath"
      :to="actionPath"
      class="btn btn-accent btn-lg"
    >
      🌳 {{ activeLabel }}
    </router-link>
    <button
      v-else-if="actionPath"
      class="btn btn-accent btn-lg"
      disabled
    >
      {{ inactiveLabel }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    project: { type: String, required: true }
});

const projectData = ref(null);

// Everything comes from the project data
const actionPath = computed(() => projectData.value?.actionPath || '');
const activeLabel = computed(() => projectData.value?.actionLabel || 'Jetzt bestellen');
const inactiveLabel = computed(() => projectData.value?.actionDisabledLabel || 'Derzeit nicht verfügbar');

watch(() => props.project, async (slug) => {
    if (!slug) return;
    try {
        projectData.value = await api.get(`/projects/${slug}`);
    } catch { /* skip */ }
}, { immediate: true });
</script>

<style scoped>
.macro-project-action {
    text-align: center;
    margin-top: var(--space-2xl);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}
</style>
