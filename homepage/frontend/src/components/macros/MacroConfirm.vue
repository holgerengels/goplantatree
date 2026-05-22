<template>
  <div class="macro-confirm">
    <!-- Loading -->
    <div v-if="loading" class="state-card card">
      <div class="state-icon">⏳</div>
      <p>Wird bestätigt…</p>
    </div>

    <!-- Confirmed -->
    <div v-else-if="state === 'confirmed'" class="state-card card">
      <div class="state-icon">✅</div>
      <h2>E-Mail bestätigt!</h2>
      <p>Deine E-Mail-Adresse wurde erfolgreich bestätigt. Du erhältst ab jetzt unseren Newsletter.</p>
      <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
    </div>

    <!-- Error -->
    <div v-else-if="state === 'error'" class="state-card card">
      <div class="state-icon">❌</div>
      <h2>Ungültiger Link</h2>
      <p>Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet.</p>
      <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api.js';

const route = useRoute();
const loading = ref(true);
const state = ref('');

onMounted(async () => {
    const token = route.params.token;
    if (!token) {
        state.value = 'error';
        loading.value = false;
        return;
    }
    try {
        await api.get(`/subscribers/confirm/${token}`);
        state.value = 'confirmed';
    } catch {
        state.value = 'error';
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.state-card {
    max-width: 500px;
    margin: var(--space-xl) auto;
    text-align: center;
    padding: var(--space-3xl) !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.state-card:hover {
    transform: none;
}

.state-icon {
    font-size: 4rem;
}

.state-card h2 {
    margin: 0;
}

.state-card p {
    margin: 0;
}

.btn {
    margin-top: var(--space-lg);
}
</style>
