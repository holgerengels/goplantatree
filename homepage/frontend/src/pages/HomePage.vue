<template>
  <div class="home-page">
    <!-- Hero -->
    <HeroSection
      :title="heroTitle"
      :subtitle="heroSubtitle"
      :background-image="heroImage"
      height="85vh"
    >
      <template #actions>
        <router-link to="/seite/baeume" class="btn btn-accent btn-lg">
          <component :is="icons.TreePine" class="btn-icon" /> Baumwissen entdecken
        </router-link>
        <router-link to="/seite/blog" class="btn btn-secondary btn-lg btn-white-glass">
          Neuigkeiten lesen <component :is="icons.ArrowRight" class="btn-icon-right" />
        </router-link>
      </template>
    </HeroSection>

    <!-- Content from CMS Page -->
    <div class="content-section" v-if="homePage?.content">
      <div class="container content-wrapper wide">
        <DynamicContent :content="homePage.content" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as icons from 'lucide-vue-next';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicContent from '../components/common/DynamicContent.vue';
import { api } from '../services/api.js';
import { useJsonLd } from '../composables/useJsonLd.js';

const homePage = ref(null);

const heroTitle = computed(() => homePage.value?.title || 'go plant a tree!');
const heroSubtitle = computed(() => homePage.value?.heroSubtitle || 'Es gibt so viele Stellen, an denen man noch Bäume pflanzen könnte … es müsste nur jemand tun!');
const heroImage = computed(() => {
    if (!homePage.value?.image) return undefined;
    return `/api/v1/media/${homePage.value.image}/file`;
});

useJsonLd(() => ({
    "@type": "WebSite",
    "name": "Go Plant A Tree",
    "url": window.location.origin,
    "description": heroSubtitle.value
}));

onMounted(async () => {
    try {
        const page = await api.get('/pages/home');
        if (page && page.published) {
            homePage.value = page;
        }
    } catch {
        // Fallback to hardcoded defaults if home page is not created
    }
});
</script>

<style scoped>
.content-section {
    padding-top: var(--space-4xl);
    padding-bottom: var(--space-4xl);
}

.content-wrapper {
    max-width: 800px;
}

.content-wrapper.wide {
    max-width: 1200px;
}

.content-wrapper :deep(h2) {
    margin-top: var(--space-2xl);
    margin-bottom: var(--space-md);
    color: var(--color-primary-dark);
}
.content-wrapper :deep(h2:first-child) {
    margin-top: 0;
}

.content-wrapper :deep(p) {
    line-height: 1.8;
    margin-bottom: var(--space-md);
}

/* Automatisch volle Breite für farbige Sektionen im CMS-Content */
.content-wrapper :deep(.section-surface),
.content-wrapper :deep(.section-alt),
.content-wrapper :deep(.section-primary),
.content-wrapper :deep(.section-primary-50) {
    width: 100vw;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
    padding-left: max(var(--space-xl), calc(50vw - (var(--max-width) / 2) + var(--space-xl)));
    padding-right: max(var(--space-xl), calc(50vw - (var(--max-width) / 2) + var(--space-xl)));
    padding-top: var(--space-4xl);
    padding-bottom: var(--space-4xl);
}

/* Entfernt den Abstand zum Hero, wenn der Content direkt mit einer farbigen Sektion beginnt */
.content-section:has(.content-html > :first-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50)) {
    padding-top: 0;
}
/* Entfernt den Abstand zum Footer, wenn der Content mit einer farbigen Sektion endet */
.content-section:has(.content-html > :last-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50)) {
    padding-bottom: 0;
}

.btn-white-glass {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
.btn-white-glass:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    color: white;
}

.btn-icon {
    width: 18px;
    height: 18px;
}

.btn-icon-right {
    width: 18px;
    height: 18px;
    margin-left: var(--space-xs);
}
</style>
