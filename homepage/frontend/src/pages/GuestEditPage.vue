<template>
  <div class="guest-edit-page">
    <HeroSection title="Beitrag" :subtitle="heroSubtitle" height="30vh" />

    <section class="section">
      <div class="container">
        <!-- Loading -->
        <div v-if="loading" class="state-card card">
          <div class="state-icon">⏳</div>
          <p>Wird geladen…</p>
        </div>

        <!-- Error -->
        <div v-else-if="loadError" class="state-card card">
          <div class="state-icon">❌</div>
          <h2>Ungültiger Link</h2>
          <p>{{ loadError }}</p>
          <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
        </div>

        <template v-else-if="item">
          <!-- Status banner -->
          <div class="status-banner card" :class="item.published ? 'is-published' : 'is-hidden'">
            <div class="status-text">
              <strong v-if="justConfirmed">🎉 E-Mail bestätigt! Der Beitrag ist jetzt veröffentlicht.</strong>
              <strong v-else-if="item.published">✅ Der Beitrag ist veröffentlicht.</strong>
              <strong v-else>🙈 Der Beitrag ist derzeit nicht öffentlich sichtbar.</strong>
              <span class="muted">Diesen Link aus der E-Mail kannst du jederzeit wieder verwenden, um den Beitrag zu bearbeiten.</span>
            </div>
            <router-link v-if="item.published" :to="`/post/${item.slug}`" class="btn btn-primary">
              Beitrag ansehen →
            </router-link>
          </div>

          <!-- Edit form -->
          <form class="edit-form card" @submit.prevent="save" novalidate>
            <h2>✏️ Beitrag bearbeiten</h2>

            <GuestPostFields
              ref="fieldsRef"
              :modelValue="formData"
              :showEmail="false"
              :showProjectSelect="allowedFields.includes('project')"
              :projects="projects"
              :currentImage="item.image"
              @update:file="onFileSelected"
              @remove-image="removeImage = true"
            />

            <div v-if="error" class="error-messages">⚠ {{ error }}</div>
            <div v-if="saveMessage" class="save-message">✅ {{ saveMessage }}</div>

            <div class="form-actions">
              <button
                v-if="allowedFields.includes('published')"
                type="button"
                class="btn btn-outline"
                :disabled="saving"
                @click="togglePublished"
              >
                {{ item.published ? 'Beitrag verbergen' : 'Beitrag wieder veröffentlichen' }}
              </button>
              <button type="submit" class="btn btn-accent" :disabled="saving">
                {{ saving ? 'Wird gespeichert …' : 'Änderungen speichern' }}
              </button>
            </div>
          </form>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import GuestPostFields from '../components/blog/GuestPostFields.vue';
import { useProjectsStore } from '../stores/projects.js';
import { useHead } from '../composables/useHead.js';
import { api } from '../services/api.js';

const route = useRoute();
const projectsStore = useProjectsStore();

const loading = ref(true);
const loadError = ref('');
const item = ref(null);
const allowedFields = ref([]);
const justConfirmed = ref(false);

const formData = reactive({ author: '', project: '', title: '', content: '' });
const file = ref(null);
const removeImage = ref(false);
const fieldsRef = ref(null);

const saving = ref(false);
const error = ref('');
const saveMessage = ref('');

const projects = computed(() => projectsStore.projects || []);
const heroSubtitle = computed(() => (justConfirmed.value ? 'Bestätigt' : 'Bearbeiten'));

useHead(() => ({ title: 'Beitrag bearbeiten', robots: 'noindex' }));

const fillForm = (doc) => {
    formData.author = doc.author || '';
    formData.project = doc.project || '';
    formData.title = doc.title || '';
    formData.content = doc.content || '';
};

const onFileSelected = (f) => {
    file.value = f;
    if (f) removeImage.value = false;
};

const buildFormData = (extra = {}) => {
    const fd = new FormData();
    fd.append('author', formData.author.trim());
    fd.append('title', formData.title.trim());
    fd.append('content', formData.content || '');
    if (allowedFields.value.includes('project')) fd.append('project', formData.project || '');
    if (file.value) fd.append('file', file.value);
    else if (removeImage.value) fd.append('removeImage', 'true');
    for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
    return fd;
};

const submitUpdate = async (extra = {}, successText = 'Änderungen gespeichert.') => {
    error.value = '';
    saveMessage.value = '';
    if (!formData.author.trim()) { error.value = 'Bitte gib einen Namen an.'; return; }
    if (!formData.title.trim()) { error.value = 'Bitte gib einen Titel an.'; return; }

    saving.value = true;
    try {
        const result = await api.upload(`/guest-edit/${route.params.token}`, buildFormData(extra), 'PUT');
        item.value = result.item;
        fillForm(result.item);
        file.value = null;
        removeImage.value = false;
        fieldsRef.value?.reset();
        justConfirmed.value = false;
        saveMessage.value = successText;
    } catch (err) {
        error.value = err.message || 'Speichern fehlgeschlagen.';
    } finally {
        saving.value = false;
    }
};

const save = () => submitUpdate();

const togglePublished = () => {
    const next = !item.value.published;
    submitUpdate(
        { published: next },
        next ? 'Der Beitrag ist wieder veröffentlicht.' : 'Der Beitrag ist jetzt verborgen.'
    );
};

onMounted(async () => {
    try {
        const result = await api.post(`/guest-edit/${route.params.token}/confirm`, {});
        item.value = result.item;
        allowedFields.value = result.allowedFields || [];
        justConfirmed.value = !!result.justConfirmed;
        fillForm(result.item);
        if (allowedFields.value.includes('project')) {
            projectsStore.fetchProjects().catch(() => {});
        }
    } catch (err) {
        loadError.value = err.message || 'Dieser Link ist ungültig oder abgelaufen.';
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.container {
    max-width: 860px;
}

.state-card {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
    padding: var(--space-3xl) !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.state-icon {
    font-size: 4rem;
}

.state-card h2,
.state-card p {
    margin: 0;
}

.card:hover {
    transform: none;
}

.status-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    border-left: 4px solid var(--color-primary);
}

.status-banner.is-hidden {
    border-left-color: var(--color-warning);
}

.status-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.edit-form h2 {
    margin: 0;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    flex-wrap: wrap;
}

.error-messages {
    color: var(--color-error);
    font-size: var(--text-sm);
}

.save-message {
    color: var(--color-primary);
    font-size: var(--text-sm);
}

.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .status-banner {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
