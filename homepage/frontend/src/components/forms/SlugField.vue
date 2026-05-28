<template>
  <div class="form-group slug-field">
    <wa-input
      type="text"
      :label="field.label"
      :required="field.required === true"
      :disabled="isLocked ? true : undefined"
      :value="modelValue || ''"
      :help-text="helpText"
      @input="handleInput($event.target.value)"
    >
      <wa-icon v-if="isLocked" name="lock" slot="suffix" style="opacity: 0.4;"></wa-icon>
    </wa-input>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue';

const props = defineProps({
    field: { type: Object, required: true },
    context: { type: Object, default: () => ({}) },
    modelValue: { required: false }
});

const emit = defineEmits(['update:modelValue']);

// Slug is locked (readonly) once the object has been saved (has _id)
const isLocked = computed(() => !!props.context?._id);

// Track whether user has manually edited the slug
const userEdited = ref(false);

const helpText = computed(() => {
    if (isLocked.value) return 'Slug kann nach dem Speichern nicht mehr geändert werden';
    return props.field.hint || 'Nur Kleinbuchstaben, Zahlen und Bindestriche';
});

/**
 * Slugify: lowercase, a-z 0-9 and hyphens only.
 * German umlauts are transliterated.
 */
function slugify(str) {
    if (!str) return '';
    return str
        .replace(/ä/gi, 'ae')
        .replace(/ö/gi, 'oe')
        .replace(/ü/gi, 'ue')
        .replace(/ß/g, 'ss')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function handleInput(val) {
    userEdited.value = true;
    // Sanitize: only allow valid slug characters
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    emit('update:modelValue', sanitized);
}

// Auto-derive slug from source field (e.g. 'name' or 'title') for new objects
if (props.field.deriveFrom && !isLocked.value) {
    watch(
        () => props.context?.[props.field.deriveFrom],
        (newVal) => {
            // Only auto-derive if: new object, user hasn't manually edited, and source has a value
            if (!props.context?._id && !userEdited.value && newVal) {
                emit('update:modelValue', slugify(newVal));
            }
        },
        { immediate: false }
    );
}
</script>

<style scoped>
.slug-field wa-input::part(input) {
    font-family: monospace;
    letter-spacing: 0.02em;
}
</style>
