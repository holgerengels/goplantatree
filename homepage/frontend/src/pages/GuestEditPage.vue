<template>
  <div class="guest-edit-page">
    <header class="page-header">
      <div class="container">
        <h1>🌱 Beitrag verwalten</h1>
        <p class="page-subtitle">{{ heroSubtitle }}</p>
      </div>
    </header>

    <div class="container page-content">
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Lade Beitrag…</p>
      </div>

      <div v-else-if="tokenError" class="state-box is-error card">
        <h2>Ungültiger Link</h2>
        <p>{{ tokenError }}</p>
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
          <router-link v-if="item.published" :to="viewUrl" class="btn btn-primary">
            Beitrag ansehen →
          </router-link>
        </div>

        <!-- Edit form -->
        <form class="edit-form card" @submit.prevent="save" novalidate>
          <h2>✏️ Beitrag bearbeiten</h2>

          <GuestPostFields
            ref="fieldsRef"
            :modelValue="formData"
            :projects="projects"
            :showEmail="false"
            :currentImage="item.image"
            @update:file="onFileSelected"
            @remove-image="removeImage = true"
          />

          <div v-if="error" class="form-error">{{ error }}</div>
          <div v-if="saveMessage" class="form-success">{{ saveMessage }}</div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Speichert…' : 'Änderungen speichern' }}
            </button>
            <button
              v-if="allowedFields.includes('published')"
              type="button"
              class="btn btn-outline"
              :disabled="saving"
              @click="togglePublished"
            >
              {{ item.published ? 'Veröffentlichung zurückziehen' : 'Beitrag veröffentlichen' }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../services/api.js';
import { useProjectsStore } from '../stores/projects.js';
import { useHead } from '../composables/useHead.js';
import GuestPostFields from '../components/blog/GuestPostFields.vue';

const route = useRoute();
const projectsStore = useProjectsStore();

const token = computed(() => route.params.token);
const loading = ref(true);
const tokenError = ref('');
const item = ref(null);
const resource = ref('');
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

const viewUrl = computed(() => {
    if (!item.value) return '/';
    return item.value.type === 'pflanzung'
        ? `/pflanzblog/${item.value.slug}`
        : `/blog/${item.value.slug}`;
});

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
    fd.append('author', (formData.author || '').trim());
    fd.append('title', (formData.title || '').trim());
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
    saving.value = true;
    try {
        const fd = buildFormData(extra);
        const res = await api.upload(`/guest-edit/${token.value}`, fd, 'PUT');
        item.value = res.item;
        fillForm(res.item);
        file.value = null;
        removeImage.value = false;
        saveMessage.value = successText;
    } catch (err) {
        error.value = err.message || 'Speichern fehlgeschlagen.';
    } finally {
        saving.value = false;
    }
};

const save = async () => {
    if (fieldsRef.value && !fieldsRef.value.validate()) return;
    await submitUpdate({}, 'Änderungen gespeichert.');
};

const togglePublished = async () => {
    const nextState = !item.value.published;
    const msg = nextState ? 'Beitrag veröffentlicht!' : 'Beitrag ist nun nicht mehr öffentlich sichtbar.';
    await submitUpdate({ published: nextState }, msg);
};

onMounted(async () => {
    projectsStore.fetchProjects();
    try {
        const res = await api.post(`/guest-edit/${token.value}/confirm`);
        item.value = res.item;
        resource.value = res.resource;
        allowedFields.value = res.allowedFields || [];
        justConfirmed.value = !!res.justConfirmed;
        fillForm(res.item);
    } catch (err) {
        tokenError.value = err.message || 'Der Bearbeitungslink ist ungültig oder abgelaufen.';
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.guest-edit-page {
    padding-bottom: var(--space-3xl);
}

.page-header {
    background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%);
    color: #ffffff;
    padding: var(--space-3xl) 0;
    margin-bottom: var(--space-2xl);
}

.page-header h1 {
    color: #ffffff;
    font-size: var(--text-3xl);
    margin-bottom: var(--space-xs);
}

.page-subtitle {
    font-size: var(--text-lg);
    opacity: 0.9;
    margin: 0;
}

.state-box {
    text-align: center;
    padding: var(--space-3xl);
}

.state-box.is-error {
    max-width: 500px;
    margin: 0 auto;
}

.status-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
    padding: var(--space-lg);
    border-left: 6px solid;
    flex-wrap: wrap;
}

.status-banner.is-published {
    border-color: var(--color-success);
    background: #f0fdf4;
}

.status-banner.is-hidden {
    border-color: var(--color-warning);
    background: #fffbeb;
}

.status-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.status-text strong {
    font-size: var(--text-base);
}

.edit-form {
    padding: var(--space-xl);
}

.edit-form h2 {
    font-size: var(--text-xl);
    margin-top: 0;
    margin-bottom: var(--space-lg);
}

.form-actions {
    display: flex;
    gap: var(--space-md);
    margin-top: var(--space-xl);
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border-light);
    flex-wrap: wrap;
}

.form-error {
    color: var(--color-error);
    margin-top: var(--space-md);
    font-size: var(--text-sm);
}

.form-success {
    color: var(--color-success);
    margin-top: var(--space-md);
    font-size: var(--text-sm);
    font-weight: 500;
}

.muted {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
}
</style>
