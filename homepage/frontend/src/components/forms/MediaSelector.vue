<template>
  <div class="media-selector">
    <div class="media-preview" v-if="previewUrl">
      <img :src="previewUrl" alt="Preview" class="preview-img" />
      <div class="media-actions">
        <wa-button appearance="filled-outlined" size="small" @click.prevent="openGallery">Auswählen / Ändern</wa-button>
        <wa-button appearance="filled-outlined" variant="danger" size="small" @click.prevent="clearSelection">Entfernen</wa-button>
      </div>
      
      <!-- Metadata Editor for Selected Media -->
      <div class="media-metadata-editor" v-if="mediaDetails">
        <h5 class="mt-4">Metadaten bearbeiten</h5>
        <wa-input label="Titel" :value="mediaDetails.title || ''" @input="mediaDetails.title = $event.target.value"></wa-input>
        <div class="input-grid">
          <wa-input label="Autor / Fotograf" :value="mediaDetails.author || ''" @input="mediaDetails.author = $event.target.value"></wa-input>
          <wa-input label="Link zum Autor" :value="mediaDetails.authorLink || ''" @input="mediaDetails.authorLink = $event.target.value"></wa-input>
        </div>
        <div class="input-grid">
          <wa-input label="Lizenz (z.B. CC BY 4.0)" :value="mediaDetails.license || ''" @input="handleLicenseInput(mediaDetails, $event.target.value)"></wa-input>
          <wa-input label="Link zur Lizenz" :value="mediaDetails.licenseLink || ''" @input="mediaDetails.licenseLink = $event.target.value"></wa-input>
        </div>
        <wa-input label="Link zur Originalquelle" :value="mediaDetails.sourceLink || ''" @input="mediaDetails.sourceLink = $event.target.value"></wa-input>
        <wa-button variant="primary" class="mt-2" @click="updateMediaDetails" :loading="savingDetails ? true : undefined">
          Metadaten Speichern
        </wa-button>
      </div>
    </div>
    <div class="media-placeholder" v-else>
      <div class="media-placeholder-actions">
        <wa-button @click.prevent="openUpload"><wa-icon slot="prefix" name="upload"></wa-icon> Hochladen</wa-button>
        <wa-button @click.prevent="openGallery"><wa-icon slot="prefix" name="images"></wa-icon> Aus Bibliothek</wa-button>
      </div>
    </div>

    <!-- Upload Modal -->
    <wa-dialog :open="showUploadModal" @wa-after-hide="showUploadModal = false" label="Neues Bild hochladen">
      <div class="upload-modal-content">
        <div class="form-group file-upload-wrapper" style="display: flex; align-items: center; gap: 1rem;">
          <wa-button @click="$refs.uploadInput.click()">
            <wa-icon slot="prefix" name="cloud-arrow-up"></wa-icon>
            Datei auswählen
          </wa-button>
          <span v-if="uploadFile?.name" class="file-name">{{ uploadFile.name }}</span>
          <input ref="uploadInput" type="file" @change="onFileChange" accept="image/*" hidden />
        </div>
        
        <h4 class="mt-4">Metadaten (optional)</h4>
        <wa-input label="Titel" :value="uploadData.title" @input="uploadData.title = $event.target.value"></wa-input>
        <div class="input-grid">
          <wa-input label="Autor / Fotograf" :value="uploadData.author" @input="uploadData.author = $event.target.value"></wa-input>
          <wa-input label="Link zum Autor" :value="uploadData.authorLink" @input="uploadData.authorLink = $event.target.value"></wa-input>
        </div>
        <div class="input-grid">
          <wa-input label="Lizenz (z.B. CC BY 4.0)" :value="uploadData.license" @input="handleLicenseInput(uploadData, $event.target.value)"></wa-input>
          <wa-input label="Link zur Lizenz" :value="uploadData.licenseLink" @input="uploadData.licenseLink = $event.target.value"></wa-input>
        </div>
        <wa-input label="Link zur Originalquelle" :value="uploadData.sourceLink" @input="uploadData.sourceLink = $event.target.value"></wa-input>

        <div class="modal-actions mt-4">
          <wa-button slot="footer" variant="primary" @click="submitUpload" :loading="uploading ? true : undefined">
            Hochladen & Verwenden
          </wa-button>
          <wa-button slot="footer" @click="showUploadModal = false">Abbrechen</wa-button>
        </div>
      </div>
    </wa-dialog>

    <!-- Gallery Modal -->
    <wa-dialog :open="showGalleryModal" @wa-after-hide="showGalleryModal = false" label="Medienbibliothek" style="--width: 800px;">
      <div class="gallery-modal-content">
        <div class="gallery-grid" v-if="galleryItems.length > 0" @scroll="onGalleryScroll">
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
        <div v-else-if="!galleryLoading" class="empty-state">
          Keine Medien gefunden.
        </div>
        <div v-if="galleryLoading" class="gallery-loading" style="text-align: center; padding: 1rem; color: var(--color-text-muted);">
          Lade Medien...
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
const savingDetails = ref(false);

const galleryItems = ref([]);
const mediaDetails = ref(null); // Full object for preview if modelValue is just ID

const uploadFile = ref(null);
const uploadData = ref({
  title: '', author: '', authorLink: '', license: '', licenseLink: '', sourceLink: ''
});

const handleLicenseInput = (targetObj, value) => {
  targetObj.license = value;
  
  if (!value) return;
  
  const l = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  let link = '';
  let norm = value;
  
  if (l === 'ccby40') { norm = 'CC BY 4.0'; link = 'https://creativecommons.org/licenses/by/4.0/deed.de'; }
  else if (l === 'ccbysa40') { norm = 'CC BY-SA 4.0'; link = 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'; }
  else if (l === 'cc0' || l === 'cc010') { norm = 'CC0 1.0 Universal'; link = 'https://creativecommons.org/publicdomain/zero/1.0/deed.de'; }
  else if (l === 'ccbync40') { norm = 'CC BY-NC 4.0'; link = 'https://creativecommons.org/licenses/by-nc/4.0/deed.de'; }
  else if (l === 'ccbyncsa40') { norm = 'CC BY-NC-SA 4.0'; link = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de'; }
  else if (l === 'ccbynd40') { norm = 'CC BY-ND 4.0'; link = 'https://creativecommons.org/licenses/by-nd/4.0/deed.de'; }
  else if (l === 'ccbyncnd40') { norm = 'CC BY-NC-ND 4.0'; link = 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de'; }
  
  if (link && (!targetObj.licenseLink || targetObj.licenseLink.includes('creativecommons.org'))) {
     targetObj.licenseLink = link;
     targetObj.license = norm;
  }
};

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

const updateMediaDetails = async () => {
  if (!mediaDetails.value || !mediaDetails.value._id) return;
  savingDetails.value = true;
  try {
    const res = await fetch(`/api/v1/media/${mediaDetails.value._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        title: mediaDetails.value.title,
        author: mediaDetails.value.author,
        authorLink: mediaDetails.value.authorLink,
        license: mediaDetails.value.license,
        licenseLink: mediaDetails.value.licenseLink,
        sourceLink: mediaDetails.value.sourceLink
      })
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Speichern fehlgeschlagen: ' + err.error);
    }
  } catch (e) {
    alert('Netzwerkfehler beim Speichern');
  } finally {
    savingDetails.value = false;
  }
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
const galleryTotal = ref(0);
const gallerySkip = ref(0);
const galleryLoading = ref(false);

const loadGalleryItems = async (skip = 0) => {
  if (galleryLoading.value) return;
  galleryLoading.value = true;
  try {
    const res = await fetch(`/api/v1/media?limit=50&skip=${skip}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (skip === 0) {
        galleryItems.value = data.items || [];
      } else {
        galleryItems.value.push(...(data.items || []));
      }
      galleryTotal.value = data.total || 0;
      gallerySkip.value = skip;
    }
  } catch (e) {
    console.error('Failed to load gallery', e);
  } finally {
    galleryLoading.value = false;
  }
};

const openGallery = async () => {
  showGalleryModal.value = true;
  await loadGalleryItems(0);
};

const onGalleryScroll = (e) => {
  const el = e.target;
  if (el.scrollHeight - el.scrollTop <= el.clientHeight + 100) {
    if (galleryItems.value.length < galleryTotal.value && !galleryLoading.value) {
      loadGalleryItems(gallerySkip.value + 50);
    }
  }
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

.media-actions {
  display: flex;
  gap: 1rem;
}

.preview-img {
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.media-metadata-editor {
  width: 100%;
  background: var(--color-surface-alt, #f9f9f9);
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  margin-top: 1rem;
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

.mt-2 {
  margin-top: 0.5rem;
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
