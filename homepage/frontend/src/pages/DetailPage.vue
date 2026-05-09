<template>
  <div class="detail-page" v-if="config && item">
    <section class="section detail-header">
      <div class="container">
        <router-link :to="`/${config.slug}`" class="back-link">
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

        <!-- Subtitle -->
        <p v-if="config.detail.subtitleField && item[config.detail.subtitleField]" class="detail-subtitle">
          {{ item[config.detail.subtitleField] }}
        </p>
      </div>
    </section>

    <section class="section detail-body">
      <div class="container">
        <div class="detail-layout" :class="{ 'has-image': item.image }">
          <!-- Image area (if exists) -->
          <div v-if="item.image" class="detail-image">
            <figure>
              <video v-if="item.image.mimeType?.startsWith('video/')" :src="item.image.url" controls autoplay loop muted playsinline></video>
              <img v-else :src="item.image.url || `/uploads/${item.image}`" :alt="item[config.detail.titleField]" />
              <figcaption v-if="item.image.title || item.image.author" class="media-caption" v-html="buildCaption(item.image)"></figcaption>
            </figure>
          </div>
          <div v-else class="detail-image-placeholder" :style="placeholderStyle">
            <span class="placeholder-emoji">
              <component :is="icons[config.icon]" v-if="icons[config.icon]" stroke-width="1.5" />
              <span v-else>{{ config.icon }}</span>
            </span>
          </div>

          <!-- Sections -->
          <div class="detail-content">
            <template v-for="section in config.detail.sections" :key="section.label">

              <!-- Specs layout: grid of label+value pairs -->
              <div v-if="section.layout === 'specs' && hasAnySpecField(section)" class="section-specs">
                <h3 v-if="section.label">{{ section.label }}</h3>
                <div class="specs-grid">
                  <div v-for="sf in section.fields" :key="sf.key" v-show="item[sf.key]" class="spec">
                    <span class="spec-label">{{ sf.label }}</span>
                    <span class="spec-value">{{ item[sf.key] }}</span>
                  </div>
                </div>
              </div>

              <!-- Notice layout: highlighted warning box -->
              <div v-else-if="section.layout === 'notice' && item[section.field]" class="section-notice card">
                <p>⚠️ {{ item[section.field] }}</p>
              </div>

              <!-- HTML layout: rendered content -->
              <div v-else-if="section.layout === 'html' && item[section.field]" class="section-html">
                <h3 v-if="section.label && section.label !== 'Inhalt'">{{ section.label }}</h3>
                <DynamicContent :content="item[section.field]" />
              </div>

              <!-- Text layout: plain text block -->
              <div v-else-if="section.layout === 'text' && item[section.field]" class="section-text">
                <h3 v-if="section.label">{{ section.label }}</h3>
                <p>{{ item[section.field] }}</p>
              </div>
            </template>


          </div>
        </div>
      </div>
    </section>
  </div>
  <div v-else class="loading container section"><p>Wird geladen…</p></div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import * as icons from 'lucide-vue-next';
import { useConfigStore } from '../stores/config.js';
import { formatDateLong as formatDate } from '../utils/format.js';
import { buildCaption } from '../utils/media.js';
import DynamicContent from '../components/common/DynamicContent.vue';

const route = useRoute();
const configStore = useConfigStore();

const config = ref(null);
const item = ref(null);

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



const placeholderStyle = computed(() => {
    const cat = item.value?.category || item.value?.type || '';
    const gradients = {
        'Laubbaum': 'linear-gradient(135deg, #4CAF50, #81C784)',
        'Halbstamm-Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
        'Hochstamm-Obstbaum': 'linear-gradient(135deg, #8D6E63, #BCAAA4)',
        'news': 'linear-gradient(135deg, #2E5641, #637648)',
        'pflanzung': 'linear-gradient(135deg, #A3DE74, #4CAF50)'
    };
    return { background: gradients[cat] || 'linear-gradient(135deg, #2E5641, #A3DE74)' };
});

const hasAnySpecField = (section) => {
    return section.fields?.some(sf => item.value?.[sf.key]);
};



const loadData = async () => {
    const slug = route.params.entity;
    const id = route.params.id;
    await configStore.fetchEntities();
    const entityInfo = configStore.findBySlug(slug);
    if (!entityInfo) return;

    config.value = await configStore.fetchConfig(entityInfo.configName);

    // Load single item — try by slug first, fallback to ID
    const res = await fetch(`${config.value.api}/${id}`);
    if (res.ok) {
        item.value = await res.json();
    }
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
.section-html {
    line-height: 1.8;
    max-width: 800px;
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
