<template>
  <div class="guest-post-fields">
    <div class="field-row">
      <div class="form-group">
        <label class="form-label required" for="gpf-author">Name</label>
        <input id="gpf-author" v-model="modelValue.author" type="text" class="form-input" required maxlength="120" />
      </div>
      <div v-if="showEmail" class="form-group">
        <label class="form-label required" for="gpf-email">E-Mail-Adresse</label>
        <input id="gpf-email" v-model="modelValue.email" type="email" class="form-input" required maxlength="200" />
        <span class="form-hint">Wird nicht veröffentlicht. Du erhältst einen Bestätigungs- und Bearbeitungslink per E-Mail.</span>
      </div>
    </div>

    <div v-if="showProjectSelect" class="form-group">
      <label class="form-label" for="gpf-project">Projekt</label>
      <select id="gpf-project" v-model="modelValue.project" class="form-input">
        <option value="">– kein Projekt –</option>
        <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name }}</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label required" for="gpf-title">Titel</label>
      <input id="gpf-title" v-model="modelValue.title" type="text" class="form-input" required maxlength="200" />
    </div>

    <div class="form-group">
      <label class="form-label" for="gpf-file">Foto</label>
      <div class="photo-field">
        <img v-if="previewUrl" :src="previewUrl" alt="Vorschau" class="photo-preview" />
        <div class="photo-actions">
          <input id="gpf-file" ref="fileInput" type="file" accept="image/*" @change="onFileChange" />
          <button v-if="previewUrl" type="button" class="btn btn-outline btn-sm" @click="removePhoto">Foto entfernen</button>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="gpf-content">Bericht</label>
      <RichTextEditor v-model="modelValue.content" :allowSource="false" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import RichTextEditor from '../forms/RichTextEditor.vue';
import { mediaUrl } from '../../utils/media.js';

const props = defineProps({
    modelValue: { type: Object, required: true },   // { author, email, project, title, content }
    showEmail: { type: Boolean, default: true },
    showProjectSelect: { type: Boolean, default: false },
    projects: { type: Array, default: () => [] },
    currentImage: { type: String, default: null }    // existing media slug (edit mode)
});

const emit = defineEmits(['update:file', 'remove-image']);

const fileInput = ref(null);
const localPreview = ref(null);
const imageRemoved = ref(false);

const previewUrl = computed(() => {
    if (localPreview.value) return localPreview.value;
    if (props.currentImage && !imageRemoved.value) return mediaUrl(props.currentImage, 'small');
    return null;
});

const revokePreview = () => {
    if (localPreview.value) URL.revokeObjectURL(localPreview.value);
    localPreview.value = null;
};

const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    revokePreview();
    if (file) {
        localPreview.value = URL.createObjectURL(file);
        imageRemoved.value = false;
    }
    emit('update:file', file);
};

const removePhoto = () => {
    revokePreview();
    if (fileInput.value) fileInput.value.value = '';
    emit('update:file', null);
    if (props.currentImage) {
        imageRemoved.value = true;
        emit('remove-image');
    }
};

// Reset removal state when the stored image changes (e.g. after saving)
watch(() => props.currentImage, () => { imageRemoved.value = false; });

const reset = () => {
    revokePreview();
    imageRemoved.value = false;
    if (fileInput.value) fileInput.value.value = '';
};

defineExpose({ reset });

onBeforeUnmount(revokePreview);
</script>

<style scoped>
.guest-post-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.form-label.required::after {
    content: ' *';
    color: var(--color-error);
}

.form-hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
}

.photo-field {
    display: flex;
    gap: var(--space-md);
    align-items: center;
    flex-wrap: wrap;
}

.photo-preview {
    width: 160px;
    height: 110px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-light);
}

.photo-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: flex-start;
}

@media (max-width: 768px) {
    .field-row {
        grid-template-columns: 1fr;
    }
}
</style>
