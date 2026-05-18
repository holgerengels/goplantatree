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

    <div class="dashboard-recent card">
      <h3>Letzte Bestellungen</h3>
      <p v-if="!recentOrders.length" class="muted">Noch keine Bestellungen vorhanden.</p>
      <table v-else class="data-table">
        <thead>
          <tr><th>Nr.</th><th>Name</th><th>Status</th><th>Datum</th></tr>
        </thead>
        <tbody>
          <tr v-for="o in recentOrders" :key="o._id">
            <td>{{ o.orderNumber }}</td>
            <td>{{ o.name }}</td>
            <td><span class="badge" :class="statusBadge(o.status)">{{ o.status }}</span></td>
            <td>{{ formatDate(o.orderedAt) }}</td>
          </tr>
        </tbody>
      </table>
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
const recentOrders = ref([]);

const statusBadge = (s) => ({
    neu: 'badge-primary', bestätigt: 'badge-accent',
    ausgegeben: 'badge-success', storniert: 'badge-warning'
}[s] || 'badge-primary');



onMounted(async () => {
    await configStore.fetchEntities();

    // Gather stats dynamically from entity configs
    const statPromises = configStore.adminEntities.map(async (entity) => {
        try {
            const cfg = await configStore.fetchConfig(entity.configName);
            if (!cfg.api) return null;
            const data = await api.get(cfg.api);
            const count = Array.isArray(data) ? data.length : (data.total || 0);
            return { icon: entity.icon, label: entity.label.plural, value: count, slug: entity.slug };
        } catch { 
            return null; 
        }
    });
    
    const results = await Promise.all(statPromises);
    stats.value = results.filter(Boolean);

    // Load recent orders
    try {
        const data = await api.get('/orders?limit=10');
        recentOrders.value = data.items || [];
    } catch { /* skip */ }
});
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

.dashboard-recent h3 {
    margin-bottom: var(--space-md);
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
}
.data-table td {
    padding: var(--space-sm);
    border-bottom: 1px solid var(--color-border-light);
    font-size: var(--text-sm);
}

.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}
</style>
