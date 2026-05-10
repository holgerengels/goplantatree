<template>
  <header :class="['app-header', { scrolled: isScrolled, 'hero-mode': isHeroMode }]">
    <div class="header-container container">
      <router-link to="/" class="header-logo">
        <img src="/images/logo-notext.svg" alt="Go Plant A Tree" class="logo-img" />
      </router-link>

      <nav class="header-nav" :class="{ open: menuOpen }">
        <template v-for="(item, idx) in headerMenu" :key="idx">
          <!-- Dynamic project links -->
          <template v-if="item.type === 'projects'">
            <router-link
              v-for="project in projects"
              :key="project._id"
              :to="`/projekt/${project.slug}`"
              class="nav-link"
              @click="menuOpen = false"
            >
              {{ project.name }}
            </router-link>
          </template>
          <!-- Auth-only links -->
          <router-link
            v-else-if="item.auth && auth.isAuthenticated"
            :to="item.to"
            class="nav-link nav-admin"
            @click="menuOpen = false"
          >
            {{ item.label }}
          </router-link>
          <!-- Standard links -->
          <router-link
            v-else-if="!item.auth"
            :to="item.to"
            class="nav-link"
            @click="menuOpen = false"
          >
            {{ item.label }}
          </router-link>
        </template>
        <!-- Admin link always last, auth-dependent -->
        <router-link v-if="auth.isAuthenticated" to="/admin" class="nav-link nav-admin" @click="menuOpen = false">Administration</router-link>
      </nav>

      <button class="menu-toggle" @click="menuOpen = !menuOpen" aria-label="Menü">
        <component :is="menuOpen ? icons.X : icons.Menu" />
      </button>
    </div>
    
    <!-- Mobile Menu Overlay -->
    <div class="mobile-overlay" :class="{ open: menuOpen }" @click="menuOpen = false"></div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import * as icons from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth.js';
import { useConfigStore } from '../../stores/config.js';
import { useProjectsStore } from '../../stores/projects.js';

const auth = useAuthStore();
const configStore = useConfigStore();
const projectsStore = useProjectsStore();
const headerMenu = computed(() => configStore.headerMenu);
const projects = computed(() => projectsStore.projects);

const isScrolled = ref(false);
const menuOpen = ref(false);
const route = useRoute();
const isHeroMode = computed(() => route.meta.hero === true || configStore.pageHeroMode);

const handleScroll = () => {
    isScrolled.value = window.scrollY > 20;
};

onMounted(() => {
    window.addEventListener('scroll', handleScroll);
    configStore.fetchMenu();
    projectsStore.fetchProjects();
});
onUnmounted(() => window.removeEventListener('scroll', handleScroll));
</script>

<style scoped>
.app-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    height: var(--header-height);
    transition: all var(--transition-base);
    background: transparent;
}

.app-header.scrolled {
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-sm);
}

.header-container {
    display: flex;
    align-items: center;
    height: 100%;
    gap: var(--space-xl);
}

.header-logo {
    flex-shrink: 0;
}
.logo-img {
    height: 48px;
    width: auto;
    transition: filter var(--transition-base);
}

.header-nav {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex: 1;
}

.nav-link {
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-full);
    font-weight: 500;
    font-size: var(--text-sm);
    color: var(--color-text); /* Default dark */
    transition: all var(--transition-fast);
    white-space: nowrap;
}
.app-header.hero-mode:not(.scrolled) .nav-link {
    color: white;
}
.nav-link:hover,
.nav-link.router-link-active {
    background: var(--color-primary-50);
    color: var(--color-primary) !important;
}

.nav-admin {
    color: var(--color-olive);
    font-style: italic;
}
.app-header.hero-mode:not(.scrolled) .nav-admin {
    color: rgba(255, 255, 255, 0.7);
}

.header-actions {
    flex-shrink: 0;
}

.btn-sm {
    padding: var(--space-xs) var(--space-lg);
    font-size: var(--text-sm);
}

.menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--color-text); /* Default dark */
    padding: var(--space-xs);
    cursor: pointer;
    z-index: 1001; /* Above mobile menu */
}
.app-header.hero-mode:not(.scrolled) .menu-toggle {
    color: white;
}

.mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 998;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--transition-base);
}
.mobile-overlay.open {
    opacity: 1;
    pointer-events: auto;
}

@media (max-width: 768px) {
    .menu-toggle {
        display: flex;
    }
    .mobile-overlay {
        display: block;
    }
    .header-nav {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 280px;
        flex-direction: column;
        background: var(--color-surface);
        padding: calc(var(--header-height) + var(--space-lg)) var(--space-lg) var(--space-lg);
        gap: var(--space-md);
        transform: translateX(100%);
        opacity: 1;
        pointer-events: none;
        transition: transform var(--transition-base);
        box-shadow: var(--shadow-xl);
        z-index: 999;
        margin: 0;
    }
    .header-nav.open {
        transform: translateX(0);
        pointer-events: auto;
    }
    .nav-link {
        width: 100%;
        padding: var(--space-md);
        font-size: var(--text-lg);
        border-radius: var(--radius-md);
        color: var(--color-text) !important;
    }
    .nav-admin {
        color: var(--color-olive) !important;
    }
}
</style>
