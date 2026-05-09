<template>
  <div class="media-selector">
    <div class="media-preview" v-if="previewUrl">
      <img :src="previewUrl" alt="Preview" class="preview-img" />
      <div class="media-actions">
        <button class="btn btn-sm btn-secondary" @click.prevent="openGallery">Ändern</button>
        <button class="btn btn-sm btn-danger" @click.prevent="clearSelection">Entfernen</button>
      </div>
    </div>
    <div class="media-placeholder" v-else>
      <div class="media-placeholder-actions">
        <button class="btn btn-secondary" @click.prevent="openUpload">📤 Hochladen</button>
        <button class="btn btn-secondary" @click.prevent="openGallery">🖼️ Aus Bibliothek</button>
      </div>
    </div>

    <!-- Upload Modal -->
    <wa-dialog :open="showUploadModal" @wa-after-hide="showUploadModal = false" label="Neues Bild hochladen">
      <div class="upload-modal-content">
        <div class="form-group">
          <label>Datei auswählen</label>
          <input type="file" @change="onFileChange" accept="image/*" class="file-input" />
        </div>
        
        <h4 class="mt-4">Metadaten (optional)</h4>
        <wa-input label="Titel" v-model="uploadData.title"></wa-input>
        <div class="input-grid">
          <wa-input label="Autor / Fotograf" v-model="uploadData.author"></wa-input>
          <wa-input label="Link zum Autor" v-model="uploadData.authorLink"></wa-input>
        </div>
        <div class="input-grid">
          <wa-input label="Lizenz (z.B. CC BY 4.0)" v-model="uploadData.license"></wa-input>
          <wa-input label="Link zur Lizenz" v-model="uploadData.licenseLink"></wa-input>
        </div>
        <wa-input label="Link zur Originalquelle" v-model="uploadData.sourceLink"></wa-input>

        <div class="modal-actions mt-4">
          <wa-button slot="footer" variant="primary" @click="submitUpload" :loading="uploading">
            Hochladen & Verwenden
          </wa-button>
          <wa-button slot="footer" @click="showUploadModal = false">Abbrechen</wa-button>
        </div>
      </div>
    </wa-dialog>

    <!-- Gallery Modal -->
    <wa-dialog :open="showGalleryModal" @wa-after-hide="showGalleryModal = false" label="Medienbibliothek" style="--width: 800px;">
      <div class="gallery-modal-content">
        <div class="gallery-grid" v-if="galleryItems.length > 0">
          <div 
            v-for="item in galleryItems" 
            :key="item._id" 
            class="gallery-item"
            @click="selectMedia(item)"
          >
            <img :src="item.url" :alt="item.title || item.originalName" />
            <div class="gallery-item-title">{{ item.title || item.originalName }}</div>
          </div>
        </div>
        <div v-else class="empty-state">
          Keine Medien gefunden.
        </div>
        
        <div class="modal-actions mt-4">
          <wa-button slot="footer" @click="showGalleryModal = false">Abbrechen</wa-button>
        </div>
      </div>
    </wa-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.js';

const props = defineProps({
  modelValue: { type: [String, Object], default: null }
});

const emit = defineEmits(['update:modelValue']);
const authStore = useAuthStore();

const showUploadModal = ref(false);
const showGalleryModal = ref(false);
const uploading = ref(false);

const galleryItems = ref([]);
const mediaDetails = ref(null); // Full object for preview if modelValue is just ID

const uploadFile = ref(null);
const uploadData = ref({
  title: '', author: '', authorLink: '', license: '', licenseLink: '', sourceLink: ''
});

// Resolve preview URL
const previewUrl = computed(() => {
  if (!props.modelValue) return null;
  if (typeof props.modelValue === 'object' && props.modelValue.url) return props.modelValue.url;
  if (mediaDetails.value && mediaDetails.value.url) return mediaDetails.value.url;
  return null;
});

// Fetch details if we only have an ID
const loadMediaDetails = async () => {
  if (props.modelValue && typeof props.modelValue === 'string') {
    try {
      const res = await fetch(`/api/v1/media/${props.modelValue}`, {
        headers: { 'Authorization': `Bearer ${authStore.token}` }
      });
      if (res.ok) {
        mediaDetails.value = await res.json();
      }
    } catch (e) {
      console.error('Failed to load media details', e);
    }
  }
};

onMounted(loadMediaDetails);
watch(() => props.modelValue, loadMediaDetails);

const clearSelection = () => {
  mediaDetails.value = null;
  emit('update:modelValue', null);
};

// Upload Logic
const openUpload = () => {
  uploadFile.value = null;
  uploadData.value = { title: '', author: '', authorLink: '', license: '', licenseLink: '', sourceLink: '' };
  showUploadModal.value = true;
};

const onFileChange = (e) => {
  if (e.target.files && e.target.files.length > 0) {
    uploadFile.value = e.target.files[0];
  }
};

const submitUpload = async () => {
  if (!uploadFile.value) {
    alert('Bitte wähle eine Datei aus.');
    return;
  }

  uploading.value = true;
  const formData = new FormData();
  formData.append('file', uploadFile.value);
  Object.keys(uploadData.value).forEach(key => {
    formData.append(key, uploadData.value[key]);
  });

  try {
    const res = await fetch('/api/v1/media', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authStore.token}` },
      body: formData
    });
    
    if (res.ok) {
      const result = await res.json();
      mediaDetails.value = result;
      emit('update:modelValue', result._id);
      showUploadModal.value = false;
    } else {
      const err = await res.json();
      alert('Upload fehlgeschlagen: ' + err.error);
    }
  } catch (e) {
    alert('Netzwerkfehler beim Upload');
  } finally {
    uploading.value = false;
  }
};

// Gallery Logic
const openGallery = async () => {
  try {
    const res = await fetch('/api/v1/media?limit=50', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      galleryItems.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load gallery', e);
  }
  showGalleryModal.value = true;
};

const selectMedia = (item) => {
  mediaDetails.value = item;
  emit('update:modelValue', item._id);
  showGalleryModal.value = false;
};
</script>

<style scoped>
.media-selector {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  background: var(--color-surface);
}

.media-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.preview-img {
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.media-placeholder {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.media-placeholder-actions {
  display: flex;
  gap: 1rem;
}

.mt-4 {
  margin-top: 1rem;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

wa-input {
  margin-bottom: 0.5rem;
}

.file-input {
  display: block;
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  max-height: 60vh;
  overflow-y: auto;
  padding: 0.5rem;
}

.gallery-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  background: #fff;
}

.gallery-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: var(--color-primary);
}

.gallery-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.gallery-item-title {
  padding: 0.5rem;
  font-size: 0.75rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
