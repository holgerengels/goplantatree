<template>
  <div class="home-page">
    <!-- Hero -->
    <HeroSection
      title="go plant a tree!"
      subtitle="Es gibt so viele Stellen, an denen man noch Bäume pflanzen könnte … es müsste nur jemand tun!"
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

    <!-- Intro / Content from Page -->
    <section class="section section-surface" v-if="homePage?.content">
      <div class="container content-html">
        <DynamicContent :content="homePage.content" />
      </div>
    </section>

    <!-- Features -->
    <section class="section features-section">
      <div class="container">
        <div class="section-title">
          <h2>Werde selbst aktiv!</h2>
          <p>Ziel dieser Initiative ist es, möglichst viele Menschen zu animieren, Bäume zu pflanzen. Wo ist noch Platz?</p>
        </div>
        <div class="features-grid">
          <div class="feature-card card" v-for="(feature, i) in features" :key="i">
            <div class="feature-icon">
              <component :is="icons[feature.icon]" stroke-width="1.5" />
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Projekte -->
    <section class="section section-alt" v-if="projects.length">
      <div class="container">
        <div class="section-title">
          <h2>Unsere Projekte</h2>
          <p>Aktuelle Baumpflanz-Aktionen</p>
        </div>
        <div class="projects-grid">
          <router-link
            v-for="project in projects"
            :key="project._id"
            :to="`/projekt/${project.slug}`"
            class="project-card card"
          >
            <div class="project-card-header">
              <h3>{{ project.name }}</h3>
              <span v-if="project.active" class="badge badge-success">Aktiv</span>
            </div>
            <p>{{ project.text }}</p>
            <div class="project-card-meta" v-if="project.orderPeriod">
              <span class="meta-date">
                <component :is="icons.Calendar" class="inline-icon" /> {{ formatDate(project.orderPeriod.start) }} – {{ formatDate(project.orderPeriod.end) }}
              </span>
            </div>
            <div class="project-card-footer">
              <span class="btn btn-primary btn-sm">Mehr erfahren <component :is="icons.ArrowRight" class="btn-icon-right" /></span>
            </div>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Blog / Neuigkeiten -->
    <section class="section blog-section">
      <div class="container">
        <div class="section-title">
          <h2>Neuigkeiten</h2>
          <p>Aktuelles aus unserer Baumpflanzarbeit</p>
        </div>
        <div class="posts-grid" v-if="latestPosts.length">
          <PostCard v-for="post in latestPosts" :key="post._id" :post="post" />
        </div>
        <p v-else class="no-posts">Noch keine Beiträge veröffentlicht.</p>
        <div class="section-more" v-if="latestPosts.length">
          <router-link to="/seite/blog" class="btn btn-secondary">
            Alle Beiträge lesen <component :is="icons.ArrowRight" class="btn-icon-right" />
          </router-link>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as icons from 'lucide-vue-next';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicContent from '../components/common/DynamicContent.vue';
import PostCard from '../components/blog/PostCard.vue';
import { useProjectsStore } from '../stores/projects.js';
import { usePostsStore } from '../stores/posts.js';
import { formatDateLong as formatDate } from '../utils/format.js';
import { api } from '../services/api.js';
import { useJsonLd } from '../composables/useJsonLd.js';

const projectsStore = useProjectsStore();
const postsStore = usePostsStore();

const projects = computed(() => projectsStore.projects);
const latestPosts = computed(() => postsStore.posts.slice(0, 3));
const homePage = ref(null);

const features = [
    { icon: 'Home', title: 'Bei dir zuhause?', description: 'Hast du schon einmal darüber nachgedacht, dort einen Baum zu pflanzen? (Wenn du zur Miete wohnst: vorher absprechen).' },
    { icon: 'School', title: 'Schule / Hochschule', description: 'Schließ dich mit ein paar Mitschüler*innen zusammen und pflanz welche! (Nach Absprache mit der Leitung).' },
    { icon: 'Users', title: 'Im Verein?', description: 'Auf dem Vereinsgelände könnte man doch noch ein paar Bäume unterbringen! Suche ein paar Mitstreiter*innen.' },
    { icon: 'Briefcase', title: 'Arbeit & Alltag', description: 'Überall kann man Platz für Bäume entdecken. Sprich die Menschen darauf an! Biete Deine Hilfe an!' }
];

useJsonLd(() => ({
    "@type": "WebSite",
    "name": "Go Plant A Tree",
    "url": window.location.origin,
    "description": "Initiative zum Pflanzen von Bäumen."
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

    await Promise.all([
        projectsStore.fetchProjects(),
        postsStore.fetchPosts({ limit: 3 })
    ]);
});
</script>

<style scoped>

.projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: var(--space-xl);
}

.project-card {
    text-decoration: none;
    color: inherit;
}
.project-card:hover {
    transform: translateY(-4px);
}
.project-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-md);
}
.project-card-meta {
    margin-top: var(--space-sm);
}
.meta-date {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
}
.project-card-footer {
    margin-top: var(--space-lg);
}

.btn-sm {
    padding: var(--space-xs) var(--space-lg);
    font-size: var(--text-sm);
}

.posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-xl);
}

.no-posts {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--space-2xl);
}

.section-more {
    text-align: center;
    margin-top: var(--space-2xl);
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

.inline-icon {
    width: 14px;
    height: 14px;
    vertical-align: middle;
    margin-right: 4px;
    display: inline-block;
    position: relative;
    top: -1px;
}


</style>
