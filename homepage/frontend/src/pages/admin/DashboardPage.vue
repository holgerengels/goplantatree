<template>
  <AdminLayout>
    <h1 class="dashboard-title">Dashboard</h1>

    <div class="dashboard-stats">
      <router-link v-for="stat in stats" :key="stat.label" :to="`/admin/${stat.slug}`" class="stat-card card">
        <span class="stat-icon">
          <component :is="icons[stat.icon]" v-if="icons[stat.icon]" />
          <span v-else>{{ stat.icon }}</span>
        </span>
        <div class="stat-info">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </router-link>
    </div>


  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as icons from 'lucide-vue-next';
import AdminLayout from '../../components/admin/AdminLayout.vue';
import { useConfigStore } from '../../stores/config.js';
import { formatDate } from '../../utils/format.js';
import { api } from '../../services/api.js';

const configStore = useConfigStore();

const stats = ref([]);




onMounted(async () => {
    await configStore.fetchEntities();

    // Gather stats dynamically from entity configs
    const statPromises = configStore.adminEntities.map(async (entity) => {
        try {
            const cfg = await configStore.fetchConfig(entity.configName);
            if (!cfg.api) return null;
            const data = await api.get(`${cfg.api}?count=true`);
            return { icon: entity.icon, label: entity.label.plural, value: data.total || 0, slug: entity.slug };
        } catch { 
            return null; 
        }
    });
    
    const results = await Promise.all(statPromises);
    stats.value = results.filter(Boolean);


</script>

<style scoped>
.dashboard-title {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-xl);
}

.dashboard-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-2xl);
}

.stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.stat-card:hover { 
    transform: translateY(-2px); 
    box-shadow: var(--shadow-md);
}

.stat-icon { 
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
}
.stat-icon svg {
    width: 32px;
    height: 32px;
}

.stat-value {
    display: block;
    font-size: var(--text-3xl);
    font-weight: 800;
    color: var(--color-primary-dark);
}

.stat-label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
}



.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}
</style>
