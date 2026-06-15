<template>
  <div class="admin-page">
    <div class="admin-layout">
      <aside class="admin-sidebar" :class="{ 'is-open': isSidebarOpen }">
        <div class="sidebar-header">
          <img src="/images/logo-notext.svg" alt="" class="sidebar-logo" />
          <span class="sidebar-title">Admin</span>
          <button class="sidebar-close-btn" @click="isSidebarOpen = false">
            <component :is="icons.X" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <router-link to="/" class="sidebar-link website-link" @click="isSidebarOpen = false">
            <component :is="icons.ArrowLeft" class="nav-icon" /> Zur Website
          </router-link>

          <div class="sidebar-divider"></div>

          <router-link to="/admin" class="sidebar-link" exact-active-class="active" @click="isSidebarOpen = false">
            <component :is="icons.BarChart" class="nav-icon" /> Dashboard
          </router-link>

          <router-link v-if="auth.hasPermission('mail', 'create')" to="/admin/newsletter" class="sidebar-link" active-class="active" @click="isSidebarOpen = false">
            <component :is="icons.Send" class="nav-icon" /> Newsletter
          </router-link>

          <div class="sidebar-divider"></div>

          <!-- Dynamic entity links from config -->
          <router-link
            v-for="entity in filteredEntities"
            :key="entity.slug"
            :to="`/admin/${entity.slug}`"
            class="sidebar-link"
            active-class="active"
            @click="isSidebarOpen = false"
          >
            <component :is="icons[entity.icon]" v-if="icons[entity.icon]" class="nav-icon" />
            <span v-else class="nav-icon">{{ entity.icon }}</span>
            {{ entity.label.plural }}
          </router-link>
        </nav>

        <div class="sidebar-footer">
          <span class="sidebar-user">{{ auth.user?.displayName || auth.user?.username }}</span>
          <button @click="logout" class="sidebar-logout">Abmelden</button>
        </div>
      </aside>

      <!-- Overlay for mobile -->
      <div class="sidebar-overlay" v-if="isSidebarOpen" @click="isSidebarOpen = false"></div>

      <main class="admin-main">
        <div class="admin-topbar">
          <button class="mobile-menu-btn" @click="isSidebarOpen = true">
            <component :is="icons.Menu" />
          </button>
        </div>
        <slot></slot>
      </main>
    </div>
  </div>
</template>
<script setup>
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as icons from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth.js';
import { useConfigStore } from '../../stores/config.js';

const isSidebarOpen = ref(false);

const router = useRouter();
const auth = useAuthStore();
const configStore = useConfigStore();

const filteredEntities = computed(() => {
    return configStore.adminEntities.filter(entity => {
        const resName = entity.resource || (entity.configName === 'media' ? 'media' : entity.configName + 's');
        return auth.hasPermission(resName, 'read');
    }).sort((a, b) => a.label.plural.localeCompare(b.label.plural));
});

const logout = () => {
    auth.logout();
    router.push('/login');
};

onMounted(() => configStore.fetchEntities());
</script>

<style scoped>
.admin-page {
    min-height: 100vh;
    background: var(--color-bg-alt);
}

.admin-layout {
    display: grid;
    grid-template-columns: 250px 1fr;
    min-height: 100vh;
}

.admin-sidebar {
    background: var(--color-primary-dark);
    color: white;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-lg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
    width: 32px;
}

.sidebar-title {
    font-weight: 700;
    font-size: var(--text-lg);
}

.sidebar-nav {
    flex: 1;
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    overflow-y: auto;
}

.sidebar-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: var(--space-sm) 0;
}

.sidebar-link {
    display: block;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: all var(--transition-fast);
    text-decoration: none;
}
.sidebar-link:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}
.sidebar-link.active {
    background: rgba(163, 222, 116, 0.2);
    color: var(--color-accent);
}

.website-link {
    color: var(--color-accent);
}
.website-link:hover {
    color: var(--color-accent-light);
}

.sidebar-footer {
    padding: var(--space-lg);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.sidebar-user {
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.7);
}

.sidebar-logout {
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--text-xs);
    text-align: left;
    cursor: pointer;
}
.sidebar-logout:hover {
    color: white;
}

.admin-main {
    padding: var(--space-2xl);
    overflow-y: auto;
}

.admin-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
}

.mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    color: var(--color-text);
    cursor: pointer;
    padding: var(--space-xs);
}

.sidebar-close-btn {
    display: none;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    margin-left: auto;
}

.sidebar-overlay {
    display: none;
}

.nav-icon {
    width: 18px;
    height: 18px;
    margin-right: var(--space-sm);
    display: inline-block;
    vertical-align: middle;
}

.sidebar-link {
    display: flex;
    align-items: center;
    padding: var(--space-xs) var(--space-lg);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .admin-layout {
        grid-template-columns: 1fr;
    }
    
    .admin-sidebar {
        position: fixed;
        left: -280px;
        top: 0;
        bottom: 0;
        width: 280px;
        z-index: 1000;
        transition: left var(--transition-normal);
    }
    
    .admin-sidebar.is-open {
        left: 0;
    }
    
    .sidebar-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    }
    
    .mobile-menu-btn {
        display: block;
    }
    
    .sidebar-close-btn {
        display: block;
    }
}
</style>
