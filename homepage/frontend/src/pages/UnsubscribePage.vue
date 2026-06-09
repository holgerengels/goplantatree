<template>
  <div class="unsubscribe-page">
    <HeroSection title="Newsletter" subtitle="Abmeldung" height="30vh" />

    <section class="section">
      <div class="container">
        <div class="unsubscribe-card card">
          <!-- Loading -->
          <div v-if="loading" class="state-message">
            <div class="state-icon">⏳</div>
            <p>Wird verarbeitet…</p>
          </div>

          <!-- Unsubscribed successfully -->
          <div v-else-if="state === 'unsubscribed'" class="state-message">
            <div class="state-icon">✅</div>
            <h2>Erfolgreich abgemeldet</h2>
            <p><strong>{{ email }}</strong> wurde vom Newsletter abgemeldet.</p>
            <p class="muted">Du erhältst keine weiteren E-Mails von uns.</p>
            <button class="btn btn-primary" @click="resubscribe" :disabled="resubscribing">
              {{ resubscribing ? 'Wird angemeldet…' : '📬 Doch wieder anmelden' }}
            </button>
          </div>

          <!-- Resubscribed successfully -->
          <div v-else-if="state === 'resubscribed'" class="state-message">
            <div class="state-icon">🎉</div>
            <h2>Wieder angemeldet!</h2>
            <p><strong>{{ email }}</strong> empfängt wieder unseren Newsletter.</p>
            <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
          </div>

          <!-- Error -->
          <div v-else-if="state === 'error'" class="state-message">
            <div class="state-icon">❌</div>
            <h2>Ungültiger Link</h2>
            <p>Dieser Abmelde-Link ist ungültig oder wurde bereits verwendet.</p>
            <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import { api } from '../services/api.js';

const route = useRoute();
const loading = ref(true);
const state = ref('');
const email = ref('');
const name = ref('');
const project = ref('');
const topic = ref('');
const resubscribing = ref(false);

onMounted(async () => {
    try {
        const result = await api.get(`/subscribers/unsubscribe/${route.params.token}`);
        email.value = result.email;
        name.value = result.name;
        project.value = result.project;
        topic.value = result.topic;
        state.value = 'unsubscribed';
    } catch {
        state.value = 'error';
    } finally {
        loading.value = false;
    }
});

const resubscribe = async () => {
    resubscribing.value = true;
    try {
        await api.post(`/subscribers/resubscribe/${route.params.token}`);
        state.value = 'resubscribed';
    } catch {
        state.value = 'error';
    } finally {
        resubscribing.value = false;
    }
};
</script>

<style scoped>
.unsubscribe-card {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
    padding: var(--space-3xl) !important;
}

.unsubscribe-card:hover {
    transform: none;
}

.state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.state-icon {
    font-size: 4rem;
}

.state-message h2 {
    margin: 0;
}

.state-message p {
    margin: 0;
}

.muted {
    color: var(--color-text-muted) !important;
    font-size: var(--text-sm);
}

.btn {
    margin-top: var(--space-lg);
}
</style>
