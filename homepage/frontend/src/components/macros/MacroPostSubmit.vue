<template>
  <div class="macro-post-submit">
    <!-- Success -->
    <div v-if="submitted" class="submit-success card">
      <div class="success-icon">📬</div>
      <h3>Fast geschafft!</h3>
      <p>{{ successMessage }}</p>
      <p class="muted">Schau bitte auch im Spam-Ordner nach.</p>
      <button type="button" class="btn btn-outline" @click="startNew">Weiteren Beitrag einreichen</button>
    </div>

    <!-- Collapsed call-to-action -->
    <div v-else-if="!open" class="submit-cta">
      <button type="button" class="btn btn-accent btn-lg" @click="open = true">{{ effectiveButtonLabel }}</button>
    </div>

    <!-- Form -->
    <form v-else class="submit-form card" @submit.prevent="submit" novalidate>
      <div class="form-header">
        <h3>{{ effectiveButtonLabel }}</h3>
        <button type="button" class="btn-close" title="Schließen" @click="open = false">✕</button>
      </div>

      <GuestPostFields
        ref="fieldsRef"
        :modelValue="formData"
        :showEmail="true"
        :showProjectSelect="!project"
        :projects="projects"
        @update:file="file = $event"
      />

      <div v-if="error" class="error-messages">⚠ {{ error }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-accent" :disabled="submitting">
          {{ submitting ? 'Wird gesendet …' : 'Beitrag einreichen' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import GuestPostFields from '../blog/GuestPostFields.vue';
import { useProjectsStore } from '../../stores/projects.js';
import { api } from '../../services/api.js';

const props = defineProps({
    type: { type: String, default: 'pflanzung' },
    project: { type: String, default: '' },
    buttonLabel: { type: String, default: '' }
});

const projectsStore = useProjectsStore();

const open = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const successMessage = ref('');
const error = ref('');
const file = ref(null);
const fieldsRef = ref(null);

const emptyForm = () => ({ author: '', email: '', project: props.project || '', title: '', content: '' });
const formData = reactive(emptyForm());

const projects = computed(() => projectsStore.projects || []);

const effectiveButtonLabel = computed(() => {
    if (props.buttonLabel) return props.buttonLabel;
    return props.type === 'pflanzung' ? '🌱 Pflanzbericht einreichen' : '✍️ Beitrag einreichen';
});

// Load projects lazily when the form is opened and no project is fixed
watch(open, (isOpen) => {
    if (isOpen && !props.project) {
        projectsStore.fetchProjects().catch(() => {});
    }
});

const validate = () => {
    if (!formData.author.trim()) return 'Bitte gib einen Namen an.';
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) return 'Bitte gib eine gültige E-Mail-Adresse an.';
    if (!formData.title.trim()) return 'Bitte gib einen Titel an.';
    const text = (formData.content || '').replace(/<[^>]*>/g, '').trim();
    if (!text) return 'Bitte schreibe einen kurzen Bericht.';
    return '';
};

const submit = async () => {
    error.value = validate();
    if (error.value) return;

    submitting.value = true;
    try {
        const fd = new FormData();
        fd.append('type', props.type);
        fd.append('author', formData.author.trim());
        fd.append('email', formData.email.trim());
        fd.append('title', formData.title.trim());
        fd.append('content', formData.content || '');
        const projectSlug = props.project || formData.project;
        if (projectSlug) fd.append('project', projectSlug);
        if (file.value) fd.append('file', file.value);

        const result = await api.upload('/guest-edit/submit/posts', fd);
        successMessage.value = result.message;
        submitted.value = true;
    } catch (err) {
        error.value = err.message || 'Beim Einreichen ist ein Fehler aufgetreten.';
    } finally {
        submitting.value = false;
    }
};

const startNew = () => {
    Object.assign(formData, emptyForm());
    file.value = null;
    error.value = '';
    submitted.value = false;
    open.value = true;
    fieldsRef.value?.reset();
};
</script>

<style scoped>
.macro-post-submit {
    width: 100%;
}

.submit-cta {
    text-align: center;
}

.submit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 800px;
    margin: 0 auto;
}

.submit-form:hover,
.submit-success:hover {
    transform: none;
}

.form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.form-header h3 {
    margin: 0;
}

.btn-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--color-text-muted);
}

.form-actions {
    display: flex;
    justify-content: flex-end;
}

.error-messages {
    color: var(--color-error);
    font-size: var(--text-sm);
}

.submit-success {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.success-icon {
    font-size: 3rem;
}

.submit-success h3,
.submit-success p {
    margin: 0;
}

.muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}
</style>
