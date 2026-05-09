<template>
  <footer class="app-footer">
    <div class="footer-wave">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z" fill="var(--color-primary)"/>
      </svg>
    </div>
    <div class="footer-content">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <router-link to="/">
              <img src="/images/logo-notext.svg" alt="Go Plant A Tree" class="footer-logo logo-tint" />
            </router-link>
            <p class="footer-mission">Wir pflanzen Bäume für eine grünere und lebenswerte Zukunft. Hilf mit!</p>
          </div>
          
          <div class="footer-links" v-if="footerNav.length">
            <h4>Navigation</h4>
            <template v-for="(item, idx) in footerNav" :key="idx">
              <a v-if="item.href" :href="item.href">{{ item.label }}</a>
              <router-link v-else :to="item.to">{{ item.label }}</router-link>
            </template>
          </div>
          
          <div class="footer-links" v-if="footerLegal.length">
            <h4>Rechtliches</h4>
            <template v-for="(item, idx) in footerLegal" :key="idx">
              <a v-if="item.href" :href="item.href">{{ item.label }}</a>
              <router-link v-else :to="item.to">{{ item.label }}</router-link>
            </template>
          </div>
          
          <div class="footer-links" v-if="footerMenu.projects && projects.length">
            <h4>Projekte</h4>
            <router-link
              v-for="project in projects"
              :key="project._id"
              :to="`/projekt/${project.slug}`"
            >
              {{ project.name }}
            </router-link>
          </div>
        </div>
        
        <div class="footer-bottom">
          <p>&copy; {{ currentYear }} Go Plant A Tree e.V. — Mit 🌱 gemacht in Ulm</p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useProjectsStore } from '../../stores/projects.js';
import { useConfigStore } from '../../stores/config.js';

const projectsStore = useProjectsStore();
const configStore = useConfigStore();
const projects = computed(() => projectsStore.projects);
const footerMenu = computed(() => configStore.footerMenu);
const footerNav = computed(() => footerMenu.value.navigation || []);
const footerLegal = computed(() => footerMenu.value.legal || []);
const currentYear = new Date().getFullYear();

onMounted(() => {
    projectsStore.fetchProjects();
    configStore.fetchMenu();
});
</script>

<style scoped>
.app-footer {
    margin-top: var(--space-4xl);
}

.footer-wave {
    line-height: 0;
    margin-bottom: -1px;
}
.footer-wave svg {
    width: 100%;
    height: 80px;
}

.footer-content {
    background: var(--color-primary);
    color: rgba(255, 255, 255, 0.85);
    padding: var(--space-3xl) 0 var(--space-xl);
}

.footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1.5fr;
    gap: var(--space-2xl);
}

.footer-brand p {
    color: rgba(255, 255, 255, 0.7);
    margin-top: var(--space-md);
    font-size: var(--text-sm);
}

.footer-logo {
    height: 56px;
    filter: brightness(10);
}

.footer-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}
.footer-links h4 {
    color: var(--color-accent);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--space-sm);
}
.footer-links a {
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--text-sm);
    font-weight: 400;
    transition: color var(--transition-fast);
}
.footer-links a:hover {
    color: var(--color-accent);
}


.footer-bottom {
    margin-top: var(--space-2xl);
    padding-top: var(--space-lg);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    text-align: center;
}
.footer-bottom p {
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .footer-grid {
        grid-template-columns: 1fr;
        gap: var(--space-xl);
    }
}
</style>
