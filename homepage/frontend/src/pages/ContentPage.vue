<template>
  <div class="content-page" v-if="page">
    <HeroSection
      v-if="page.heroSubtitle"
      :title="page.title"
      :subtitle="page.heroSubtitle"
      height="40vh"
    />

    <div class="content-section" :style="page.heroSubtitle ? {} : { paddingTop: 'calc(var(--header-height) + var(--space-2xl))' }">
      <div class="container content-wrapper" :class="{ 'wide': hasWideMacro }">
        <h1 v-if="!page.heroSubtitle">{{ page.title }}</h1>
        <DynamicContent :content="page.content" />
      </div>
    </div>
  </div>
  <div v-else-if="loading" class="loading container section"><p>Wird geladen…</p></div>
  <div v-else-if="error" class="loading container section"><p>{{ error }}</p></div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicContent from '../components/common/DynamicContent.vue';
import { useConfigStore } from '../stores/config.js';
import { useJsonLd } from '../composables/useJsonLd.js';
import { api } from '../services/api.js';

const route = useRoute();
const configStore = useConfigStore();

const props = defineProps({
    pageSlugOverride: { type: String, default: '' }
});

const page = ref(null);
const loading = ref(false);
const error = ref(null);

const slug = computed(() => props.pageSlugOverride || route.params.slug || route.meta.pageSlug);

// Detect if content has wide macros (trees, posts, projects) to use full-width layout
const hasWideMacro = computed(() => {
    if (!page.value?.content) return false;
    return /\[(trees|posts|projects|offerings)/i.test(page.value.content);
});

useJsonLd(() => {
    if (!page.value) return null;
    return {
        "@type": "WebPage",
        "name": page.value.title,
        "description": page.value.heroSubtitle || page.value.title,
        "url": window.location.href
    };
});

const loadPage = async () => {
    if (!slug.value) return;
    loading.value = true;
    error.value = null;
    try {
        page.value = await api.get(`/pages/${slug.value}`);
        configStore.pageHeroMode = !!page.value.heroSubtitle;
        if (page.value.title) {
            document.title = `${page.value.title} — Go Plant A Tree`;
        }
    } catch (err) {
        error.value = err.message || 'Seite nicht gefunden';
        page.value = null;
        configStore.pageHeroMode = false;
    } finally {
        loading.value = false;
    }
};

onUnmounted(() => {
    configStore.pageHeroMode = false;
});

onMounted(loadPage);
watch(slug, loadPage);
</script>

<style scoped>
.content-wrapper {
    max-width: 800px;
}

.content-section {
    padding-top: var(--space-4xl);
    padding-bottom: var(--space-4xl);
}

/* Entfernt den Abstand zum Hero, wenn der Content direkt mit einer farbigen Sektion beginnt */
.content-section:not([style*="padding-top"]):has(.content-html > :first-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50)) {
    padding-top: 0;
}
/* Entfernt den Abstand zum Footer, wenn der Content mit einer farbigen Sektion endet */
.content-section:has(.content-html > :last-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50)) {
    padding-bottom: 0;
}


.content-wrapper.wide {
    max-width: 1200px;
}

.content-wrapper h1 {
    margin-bottom: var(--space-xl);
}

.content-wrapper :deep(h2) {
    margin-top: var(--space-2xl);
    margin-bottom: var(--space-md);
}
.content-wrapper :deep(h2:first-child) {
    margin-top: 0;
}

.content-wrapper :deep(p) {
    line-height: 1.8;
    margin-bottom: var(--space-md);
}

/* Automatisch volle Breite für farbige Sektionen im CMS-Content (auch wenn .section fehlt) */
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
    /* Der Text innen wird durch horizontales Padding automatisch auf die Container-Breite begrenzt */
    padding-left: max(var(--space-xl), calc(50vw - (var(--max-width) / 2) + var(--space-xl)));
    padding-right: max(var(--space-xl), calc(50vw - (var(--max-width) / 2) + var(--space-xl)));
    /* Vertikales Padding für ordentlichen Abstand, falls die Basis-.section Klasse fehlt */
    padding-top: var(--space-4xl);
    padding-bottom: var(--space-4xl);
}


.loading {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
