<template>
  <div class="content-page" v-if="page">
    <HeroSection
      v-if="page.heroSubtitle"
      :title="page.title"
      :subtitle="page.heroSubtitle"
      height="40vh"
    />

    <SectionNav v-if="page.showSectionNav !== false" :content-watch="page.content" target-selector=".content-html" />

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
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicContent from '../components/common/DynamicContent.vue';
import SectionNav from '../components/common/SectionNav.vue';
import { useConfigStore } from '../stores/config.js';
import { useJsonLd } from '../composables/useJsonLd.js';
import { useHead } from '../composables/useHead.js';
import { api } from '../services/api.js';
import { fillTemplate, getPath } from '../utils/fillTemplate.js';

/**
 * Renders CMS pages. Three modes:
 *   - /seite/:slug                 → Page by slug
 *   - pageSlugOverride             → fixed Page (projekt-<slug>, 404, …)
 *   - entity + id (+ scope)        → entity detail: Page "detail-<entity-slug>" used as
 *                                    template, filled with the item ({{field}}, {{field|fmt}})
 */
const DETAIL_PAGE_PREFIX = 'detail-';

const route = useRoute();
const configStore = useConfigStore();

const props = defineProps({
    pageSlugOverride: { type: String, default: '' },
    entity: { type: String, default: '' },   // entity slug, e.g. "baeume"
    scope: { type: String, default: '' },    // scope value, e.g. project slug for offerings
    id: { type: String, default: '' }        // item slug / id
});

const page = ref(null);
const loading = ref(false);
const error = ref(null);

// Entity detail mode: current item + its config (provided to macros like [[fields]])
const entityContext = ref(null);
provide('entityContext', entityContext);

const isEntityMode = computed(() => !!(props.entity && props.id));
const slug = computed(() => props.pageSlugOverride || route.params.slug || route.meta.pageSlug);

// Use the wideLayout flag from the page data for wider container
const hasWideMacro = computed(() => !!page.value?.wideLayout);

const mediaFile = (imageSlug) => imageSlug ? `/api/v1/media/by-slug/${imageSlug}/file` : null;

/** SEO values of the current item, mapped via config.public.seo */
const entitySeo = computed(() => {
    const ctx = entityContext.value;
    if (!ctx) return null;
    const seo = ctx.config.public?.seo || {};
    const get = (key) => (seo[key] ? getPath(ctx.item, seo[key]) : null);
    return { title: get('title'), description: get('description'), image: get('image') };
});

/** JSON-LD from config.public.jsonld = { "@type": …, mapping: { ldKey: itemPath } } */
const buildEntityJsonLd = () => {
    const { item, config } = entityContext.value;
    const def = config.public?.jsonld;
    if (!def) return null;
    const ld = { "@type": def["@type"] || def.type, "url": window.location.href };
    for (const [ldKey, itemPath] of Object.entries(def.mapping || {})) {
        const val = getPath(item, itemPath);
        if (!val) continue;
        if (ldKey === 'author' && typeof val === 'string') {
            ld[ldKey] = { "@type": "Person", "name": val };
        } else if (ldKey === 'image' && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
            ld[ldKey] = window.location.origin + mediaFile(val);
        } else if (ldKey === 'articleBody' && typeof val === 'string') {
            const text = val.replace(/<[^>]*>/g, '').trim();
            ld[ldKey] = text.length > 500 ? text.slice(0, 500) + '…' : text;
        } else {
            ld[ldKey] = val;
        }
    }
    return ld;
};

useJsonLd(() => {
    if (!page.value) return null;
    if (entityContext.value) return buildEntityJsonLd();
    return {
        "@type": "WebPage",
        "name": page.value.title,
        "description": page.value.heroSubtitle || page.value.title,
        "url": window.location.href
    };
});

useHead(() => {
    if (!page.value) return null;
    if (entitySeo.value) {
        return {
            title: entitySeo.value.title || page.value.title,
            description: entitySeo.value.description || page.value.heroSubtitle || page.value.title,
            image: mediaFile(entitySeo.value.image) || mediaFile(page.value.image),
            type: 'article'
        };
    }
    return {
        title: page.value.title,
        description: page.value.heroSubtitle || page.value.title,
        image: mediaFile(page.value.image)
    };
});

/**
 * Load item + template page for entity detail mode.
 * Returns the filled page object, or throws if not found / not public.
 */
const loadEntityPage = async () => {
    await configStore.fetchEntities();
    const entityInfo = configStore.findBySlug(props.entity);
    if (!entityInfo) throw new Error('Seite nicht gefunden');
    const config = await configStore.fetchConfig(entityInfo.configName);
    if (!config.public) throw new Error('Seite nicht gefunden');

    // Scoped entities (slug only unique within scope) need the scope segment — and vice versa
    const scopeField = config.public.scopeField;
    if (!!scopeField !== !!props.scope) throw new Error('Seite nicht gefunden');
    const query = scopeField ? `?${scopeField}=${encodeURIComponent(props.scope)}` : '';

    const [template, item] = await Promise.all([
        api.get(`/pages/${DETAIL_PAGE_PREFIX}${props.entity}`),
        api.get(`${config.api.replace('/api/v1', '')}/${encodeURIComponent(props.id)}${query}`)
    ]);
    if (template.published === false) throw new Error('Seite nicht gefunden');

    const rawFields = (config.fields || []).filter(f => f.type === 'RichText').map(f => f.name);
    entityContext.value = { item, config };
    return {
        ...template,
        title: fillTemplate(template.title, item, { escape: false }),
        heroSubtitle: fillTemplate(template.heroSubtitle, item, { escape: false }),
        content: fillTemplate(template.content, item, { rawFields })
    };
};

const loadPage = async () => {
    if (!isEntityMode.value && !slug.value) return;
    loading.value = true;
    error.value = null;
    entityContext.value = null;
    try {
        page.value = isEntityMode.value
            ? await loadEntityPage()
            : await api.get(`/pages/${slug.value}`);
        configStore.pageHeroMode = !!page.value.heroSubtitle;
    } catch (err) {
        error.value = err.message || 'Seite nicht gefunden';
        page.value = null;
        entityContext.value = null;
        configStore.pageHeroMode = false;
    } finally {
        loading.value = false;
    }
};

onUnmounted(() => {
    configStore.pageHeroMode = false;
});

onMounted(loadPage);
watch(() => [slug.value, props.entity, props.scope, props.id], loadPage);
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
.content-section:not([style*="padding-top"]):has(.content-html > :first-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50, .section-secondary)) {
    padding-top: 0;
}
/* Entfernt den Abstand zum Footer, wenn der Content mit einer farbigen Sektion endet */
.content-section:has(.content-html > :last-child:is(.section-surface, .section-alt, .section-primary, .section-primary-50, .section-secondary)) {
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
.content-wrapper :deep(.section-primary-50),
.content-wrapper :deep(.section-secondary) {
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
