<template>
  <div class="detail-page" v-if="config && item">
    <section class="section detail-header">
      <div class="container">
        <router-link :to="listUrl" class="back-link">
          ← Zurück zu {{ config.label.plural }}
        </router-link>

        <!-- Badges -->
        <div class="detail-badges" v-if="badges.length">
          <span v-for="b in badges" :key="b.text" :class="['badge', b.class]">{{ b.text }}</span>
        </div>

        <h1>{{ item[config.detail.titleField] }}</h1>

        <!-- Meta info -->
        <div class="detail-meta" v-if="config.detail.meta?.length">
          <span v-for="m in config.detail.meta" :key="m.key" class="meta-item">
            <template v-if="m.type === 'date'">{{ formatDate(item[m.key]) }}</template>
            <template v-else>{{ item[m.key] }}</template>
          </span>
        </div>

      </div>
    </section>

    <section class="section detail-body">
      <div class="container">
        <div class="detail-layout" :class="{ 'has-image': item.image }">
          <!-- Image area (if exists) -->
          <div v-if="imageData" class="detail-image">
            <figure>
              <video v-if="imageData.mimeType?.startsWith('video/')" :src="imageData.fileUrl" controls autoplay loop muted playsinline></video>
              <img v-else :src="imageData.fileUrl" :alt="item[config.detail.titleField]" />
              <figcaption v-if="imageData.title || imageData.author" class="media-caption" v-html="buildCaption(imageData)"></figcaption>
            </figure>
          </div>
          <div v-else class="detail-image-placeholder" :style="placeholderStyle">
            <span class="placeholder-emoji">
              <component :is="icons[config.icon]" v-if="icons[config.icon]" stroke-width="1.5" />
              <span v-else>{{ config.icon }}</span>
            </span>
          </div>

          <!-- Short Sections (Specs, Notice, Subtitle) next to image -->
          <div class="detail-content detail-sidebar">
            <!-- Subtitle (Excerpt) moved here -->
            <p v-if="config.detail.subtitleField && item[config.detail.subtitleField]" class="detail-subtitle">
              {{ item[config.detail.subtitleField] }}
            </p>

            <template v-for="section in shortSections" :key="section.label">
              <div v-if="section.layout === 'specs' && hasAnySpecField(section)" class="section-specs">
                <h3 v-if="section.label">{{ section.label }}</h3>
                <div class="specs-grid">
                  <div v-for="sf in section.fields" :key="sf.key" v-show="hasSpecValue(item[sf.key])" class="spec">
                    <span class="spec-label">{{ sf.label }}</span>
                    <span v-if="Array.isArray(item[sf.key])" class="spec-value spec-tags">
                      <span v-for="tag in item[sf.key]" :key="tag" class="spec-tag">{{ tag }}</span>
                    </span>
                    <span v-else class="spec-value">{{ item[sf.key] }}</span>
                  </div>
                </div>
              </div>

              <div v-else-if="section.layout === 'notice' && item[section.field]" class="section-notice card">
                <p>⚠️ {{ item[section.field] }}</p>
              </div>
            </template>
          </div>
        </div>

        <!-- Long Sections (HTML, Text) below image and specs -->
        <div class="detail-main-content">
          <template v-for="section in longSections" :key="section.label">
            <div v-if="section.layout === 'html' && item[section.field]" class="section-html">
              <h3 v-if="section.label && section.label !== 'Inhalt'">{{ section.label }}</h3>
              <DynamicContent :content="item[section.field]" />
            </div>

            <div v-else-if="section.layout === 'text' && item[section.field]" class="section-text">
              <h3 v-if="section.label">{{ section.label }}</h3>
              <p>{{ item[section.field] }}</p>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
  <div v-else class="loading container section"><p>Wird geladen…</p></div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import * as icons from 'lucide-vue-next';
import { useConfigStore } from '../stores/config.js';
import { formatDateLong as formatDate } from '../utils/format.js';
import { buildCaption } from '../utils/media.js';
import { getCategoryGradient } from '../utils/gradients.js';
import { api } from '../services/api.js';
import DynamicContent from '../components/common/DynamicContent.vue';
import { useJsonLd } from '../composables/useJsonLd.js';

const route = useRoute();
const configStore = useConfigStore();

const config = ref(null);
const item = ref(null);
const imageData = ref(null);

// Resolve image slug to media info
watch(() => item.value?.image, async (imageSlug) => {
    if (!imageSlug) { imageData.value = null; return; }
    if (typeof imageSlug === 'string') {
        try {
            const info = await api.get(`/media/by-slug/${imageSlug}/info`);
            imageData.value = {
                ...info,
                fileUrl: `/api/v1/media/by-slug/${imageSlug}/file`
            };
        } catch {
            // Media not found — graceful fallback
            imageData.value = null;
        }
    }
}, { immediate: false });

const listUrl = computed(() => {
    if (config.value?.listPage) return config.value.listPage;
    return `/${config.value?.slug}`;
});

const badges = computed(() => {
    if (!config.value?.detail?.badges || !item.value) return [];
    const result = [];
    for (const badge of config.value.detail.badges) {
        const val = item.value[badge.field];
        if (badge.map && badge.map[val]) {
            result.push({ text: badge.map[val].label, class: badge.map[val].class });
        } else if (badge.trueLabel !== undefined) {
            result.push({
                text: val ? badge.trueLabel : badge.falseLabel,
                class: val ? badge.trueClass : badge.falseClass
            });
        } else if (val && typeof val === 'string') {
            result.push({ text: val, class: badge.class || 'badge-accent' });
        }
    }
    return result;
});

const shortSections = computed(() => {
    if (!config.value?.detail?.sections) return [];
    return config.value.detail.sections.filter(s => s.layout !== 'html' && s.layout !== 'text');
});

const longSections = computed(() => {
    if (!config.value?.detail?.sections) return [];
    return config.value.detail.sections.filter(s => s.layout === 'html' || s.layout === 'text');
});

const placeholderStyle = computed(() => {
    const cat = item.value?.category || item.value?.type || '';
    return { background: getCategoryGradient(cat) };
});

const hasSpecValue = (val) => {
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
};

const hasAnySpecField = (section) => {
    return section.fields?.some(sf => hasSpecValue(item.value?.[sf.key]));
};

const resolvePath = (obj, path) => {
    return path.split('.').reduce((o, i) => o ? o[i] : null, obj);
};

useJsonLd(() => {
    if (!config.value?.jsonld || !item.value) return null;
    
    const ld = {
        "@type": config.value.jsonld["@type"] || config.value.jsonld.type,
        "url": window.location.href
    };
    
    if (config.value.jsonld.mapping) {
        for (const [ldKey, itemPath] of Object.entries(config.value.jsonld.mapping)) {
            const val = resolvePath(item.value, itemPath);
            if (val) {
                if (typeof val === 'string' && val.startsWith('/')) {
                    ld[ldKey] = window.location.origin + val;
                } else {
                    ld[ldKey] = val;
                }
            }
        }
    }
    
    return ld;
});

const loadData = async () => {
    const slug = route.params.entity;
    const id = route.params.id;
    await configStore.fetchEntities();
    const entityInfo = configStore.findBySlug(slug);
    if (!entityInfo) return;

    config.value = await configStore.fetchConfig(entityInfo.configName);

    // Load single item
    try {
        item.value = await api.get(`${config.value.api.replace('/api/v1', '')}/${id}`);
    } catch { /* 404 or error */ }
};

onMounted(loadData);

watch(() => [route.params.entity, route.params.id], loadData);
</script>

<style scoped>
.detail-header {
    padding-top: calc(var(--header-height) + var(--space-2xl));
    padding-bottom: var(--space-xl);
}

.back-link {
    display: inline-block;
    margin-bottom: var(--space-lg);
    font-size: var(--text-sm);
}

.detail-badges {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
}

.detail-header h1 {
    margin-bottom: var(--space-sm);
}

.detail-meta {
    display: flex;
    gap: var(--space-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin-bottom: var(--space-sm);
}

.detail-subtitle {
    font-size: var(--text-lg);
    color: var(--color-text-secondary);
    max-width: 800px;
}

.detail-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3xl);
    align-items: start;
}

.detail-image img,
.detail-image video {
    width: 100%;
    border-radius: var(--radius-lg);
    display: block;
}

figure {
    margin: 0;
    padding: 0;
}

.media-caption {
    margin-top: var(--space-sm);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: right;
}

.detail-image-placeholder {
    width: 100%;
    height: 400px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
}

.placeholder-emoji {
    color: white;
    opacity: 0.3;
}
.placeholder-emoji svg {
    width: 6rem;
    height: 6rem;
}

.detail-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

/* Section: Specs */
.section-specs h3 {
    margin-bottom: var(--space-md);
}

.specs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
}

.spec {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-alt);
    padding: var(--space-md);
    border-radius: var(--radius-md);
}

.spec-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-xs);
}

.spec-value {
    font-weight: 600;
    color: var(--color-primary-dark);
}

.spec-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.spec-tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    background: var(--color-primary-50, rgba(46, 86, 65, 0.1));
    color: var(--color-primary-dark);
    font-size: var(--text-xs);
    font-weight: 500;
}

/* Section: Notice */
.section-notice {
    background: rgba(255, 152, 0, 0.08) !important;
    border-color: rgba(255, 152, 0, 0.2) !important;
}
.section-notice:hover {
    transform: none;
}
.section-notice p {
    margin: 0;
    color: var(--color-text);
}

/* Section: HTML */
.detail-main-content {
    margin-top: var(--space-3xl);
    max-width: 900px;
}

.section-html {
    line-height: 1.8;
}
.section-html h3 {
    margin-bottom: var(--space-md);
}

/* Section: Text */
.section-text h3 {
    margin-bottom: var(--space-sm);
}

.detail-cta {
    align-self: flex-start;
    margin-top: var(--space-md);
}

.loading {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

@media (max-width: 768px) {
    .detail-layout {
        grid-template-columns: 1fr;
    }
    .detail-image-placeholder {
        height: 250px;
    }
}
</style>
