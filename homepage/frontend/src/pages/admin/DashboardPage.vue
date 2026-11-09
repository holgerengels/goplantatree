<template>
  <AdminLayout>
    <h1 class="dashboard-title">Dashboard</h1>

    <div class="dashboard-stats">
      <router-link v-for="stat in stats" :key="stat.label" :to="`/admin/${stat.slug}`" class="stat-card card">
        <div class="stat-header">
          <span class="stat-icon">
            <component :is="icons[stat.icon]" v-if="icons[stat.icon]" />
            <span v-else>{{ stat.icon }}</span>
          </span>
          <span class="stat-value">{{ stat.value }}</span>
        </div>
        <span class="stat-label">{{ stat.label }}</span>
      </router-link>
    </div>

    <!-- Consistency Check Section -->
    <div class="consistency-section card">
      <div class="consistency-header">
        <div>
          <h2>Konsistenzprüfung</h2>
          <p class="muted">Prüft, ob für jeden Beitrags- und Entity-Typ eine Listen- und eine Detailseite vorhanden ist.</p>
        </div>
        <div class="consistency-summary">
          <span v-if="consistencyLoading" class="badge">Wird geprüft…</span>
          <span v-else-if="allConsistencyOk" class="badge badge-success">✓ Alle Seiten vorhanden</span>
          <span v-else class="badge badge-warning">⚠ {{ issueCount }} Unvollständigkeit(en)</span>
        </div>
      </div>

      <div v-if="!consistencyLoading" class="consistency-table-wrapper">
        <table class="consistency-table">
          <thead>
            <tr>
              <th>Bereich / Typ</th>
              <th>Detailseite (Vorlage)</th>
              <th>Listenseite</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="check in consistencyChecks" :key="check.category + check.name">
              <td>
                <span class="check-category">{{ check.category }}:</span>
                <strong>{{ check.name }}</strong>
              </td>
              <td>
                <span v-if="check.detailPage.page" class="status-ok">
                  ✓ {{ check.detailPage.page.slug }}
                </span>
                <span v-else class="status-missing">
                  ✕ Fehlt (<code>{{ check.detailPage.expected }}</code>)
                </span>
              </td>
              <td>
                <span v-if="check.listPage.page" class="status-ok">
                  <template v-if="check.listPage.isScoped">
                    ✓ In {{ check.listPage.page.slug }}
                  </template>
                  <a v-else :href="`/${check.listPage.page.slug}`" target="_blank">
                    ✓ /{{ check.listPage.page.slug }}
                  </a>
                </span>
                <span v-else class="status-missing">
                  ✕ Fehlt (<code>{{ check.listPage.expected }}</code>)
                </span>
              </td>
              <td>
                <span v-if="check.ok" class="badge badge-success badge-sm">OK</span>
                <span v-else class="badge badge-warning badge-sm">Fehlt</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as icons from 'lucide-vue-next';
import AdminLayout from '../../components/admin/AdminLayout.vue';
import { useConfigStore } from '../../stores/config.js';
import { api } from '../../services/api.js';

const configStore = useConfigStore();

const stats = ref([]);
const consistencyChecks = ref([]);
const consistencyLoading = ref(true);

const issueCount = computed(() => consistencyChecks.value.filter(c => !c.ok).length);
const allConsistencyOk = computed(() => !consistencyLoading.value && issueCount.value === 0);

const runConsistencyCheck = async () => {
    consistencyLoading.value = true;
    try {
        const pagesRes = await api.get('/pages?all=true');
        const pageList = Array.isArray(pagesRes) ? pagesRes : (pagesRes.items || []);

        const checks = [];

        // 1. Post types checks
        let postConfig = null;
        try {
            postConfig = await configStore.fetchConfig('post');
        } catch (_) {}
        const postTypes = postConfig?.fields?.find(f => f.name === 'type')?.options || ['news', 'artikel', 'pflanzung'];

        const postDetailSlug = 'detail-blog';
        const postDetailFound = pageList.find(p => p.slug === postDetailSlug);

        for (const pt of postTypes) {
            const typeRegex = new RegExp(`\\[\\[(posts|blog)\\b[^\\]]*type=["']?${pt}["']?[^\\]]*\\]\\]`, 'i');
            let listFound = pageList.find(p => p.content && typeRegex.test(p.content));
            if (!listFound) {
                if (pt === 'pflanzung') {
                    listFound = pageList.find(p => p.slug === 'pflanzblog');
                } else if (pt === 'news') {
                    listFound = pageList.find(p => ['aktuelles', 'news', 'blog'].includes(p.slug));
                } else if (pt === 'artikel') {
                    listFound = pageList.find(p => ['magazin', 'artikel', 'blog'].includes(p.slug));
                }
            }

            const labelMap = {
                pflanzung: 'Pflanzung',
                news: 'News',
                artikel: 'Artikel'
            };

            checks.push({
                category: 'Beitragstyp',
                name: labelMap[pt] || pt,
                typeKey: pt,
                detailPage: {
                    expected: postDetailSlug,
                    page: postDetailFound || null
                },
                listPage: {
                    expected: pt === 'pflanzung' ? 'pflanzblog' : pt,
                    page: listFound || null,
                    isScoped: false
                },
                ok: !!postDetailFound && !!listFound
            });
        }

        // 2. Entity types checks (entities with public detail pages)
        for (const ent of configStore.adminEntities) {
            let cfg = null;
            try {
                cfg = await configStore.fetchConfig(ent.configName);
            } catch (_) {}
            if (!cfg?.public || ent.slug === 'post' || ent.slug === 'blog') continue;

            const detailSlug = `detail-${ent.slug}`;
            const detailFound = pageList.find(p => p.slug === detailSlug);

            const macroNameMap = {
                'baeume': 'trees',
                'angebote': 'offerings',
                'projekte': 'projects'
            };
            const expectedMacro = macroNameMap[ent.slug] || ent.slug;
            const macroRegex = new RegExp(`\\[\\[${expectedMacro}\\b`, 'i');

            let listFound = null;
            let listExpected = ent.slug;
            let isScoped = false;

            if (cfg.public?.scopeField === 'project') {
                // Scoped entities (offerings per project) don't have a single global list page,
                // but are embedded into project pages via macro
                isScoped = true;
                const pagesWithMacro = pageList.filter(p => p.content && macroRegex.test(p.content));
                listFound = pagesWithMacro.length > 0 ? { slug: `${pagesWithMacro.length} Projektseite(n)` } : null;
                listExpected = `[[${expectedMacro}]] in Projektseiten`;
            } else {
                listFound = pageList.find(p => (p.content && macroRegex.test(p.content)) || p.slug === ent.slug);
            }

            checks.push({
                category: 'Entity-Typ',
                name: ent.label?.plural || ent.slug,
                typeKey: ent.slug,
                detailPage: {
                    expected: detailSlug,
                    page: detailFound || null
                },
                listPage: {
                    expected: listExpected,
                    page: listFound || null,
                    isScoped
                },
                ok: !!detailFound && !!listFound
            });
        }

        consistencyChecks.value = checks;
    } catch (err) {
        console.error('Failed to run consistency check:', err);
    } finally {
        consistencyLoading.value = false;
    }
};

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

    await runConsistencyCheck();
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
    flex-direction: column;
    gap: var(--space-xs);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.stat-card:hover { 
    transform: translateY(-2px); 
    box-shadow: var(--shadow-md);
}

.stat-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
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
    line-height: 1.1;
}

.stat-label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: 1.3;
}

.consistency-section {
    padding: var(--space-xl);
    margin-top: var(--space-xl);
}

.consistency-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
}

.consistency-header h2 {
    margin: 0 0 var(--space-xs) 0;
    font-size: var(--text-xl);
}

.consistency-table-wrapper {
    overflow-x: auto;
}

.consistency-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
}

.consistency-table th,
.consistency-table td {
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    border-bottom: 1px solid var(--color-border-light, #e2e8f0);
}

.consistency-table th {
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-bg-alt, #f8fafc);
}

.check-category {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    display: block;
}

.status-ok {
    color: var(--color-success, #2e7d32);
}

.status-missing {
    color: var(--color-error, #c62828);
}

.status-missing code {
    font-size: var(--text-xs);
    background: rgba(198, 40, 40, 0.08);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
}

.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: var(--radius-full, 9999px);
    font-size: var(--text-xs);
    font-weight: 600;
}

.badge-sm {
    padding: 2px 8px;
    font-size: 0.75rem;
}

.badge-success {
    background: #e8f5e9;
    color: #2e7d32;
}

.badge-warning {
    background: #fff3e0;
    color: #ef6c00;
}

.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}
</style>
