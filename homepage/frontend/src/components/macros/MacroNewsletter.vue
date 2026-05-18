<template>
  <div class="macro-newsletter">
    <div class="newsletter-box">
      <div class="newsletter-content">
        <h2>🌱 Bleib auf dem Laufenden</h2>
        <p>Erfahre als Erste*r, wann die nächste Aktion für dieses Projekt startet.</p>
      </div>
      <form class="newsletter-form" @submit.prevent="subscribe">
        <input v-model="email" type="email" placeholder="Deine E-Mail-Adresse" class="form-input" required />
        <button type="submit" class="btn btn-accent" :disabled="subscribing">
          {{ subscribing ? '...' : 'Anmelden' }}
        </button>
      </form>
      <p v-if="subscribeMessage" class="subscribe-message">{{ subscribeMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    project: {
        type: String,
        default: ''
    }
});

const email = ref('');
const subscribing = ref(false);
const subscribeMessage = ref('');

const subscribe = async () => {
    subscribing.value = true;
    try {
        const payload = { 
            email: email.value, 
            topic: 'general' 
        };
        
        if (props.project) {
            payload.project = props.project;
        }

        const data = await api.post('/subscribers', payload);
        subscribeMessage.value = '✅ ' + data.message;
        email.value = '';
    } catch (err) {
        subscribeMessage.value = '⚠ ' + (err.message || 'Fehler beim Anmelden');
    } finally {
        subscribing.value = false;
    }
};
</script>

<style scoped>
.macro-newsletter {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-bg));
    padding: var(--space-2xl) var(--space-md);
    border-radius: var(--radius-xl);
    margin: var(--space-2xl) 0;
}

.newsletter-box {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
}

.newsletter-content h2 {
    margin-bottom: var(--space-sm);
    color: var(--color-primary-dark);
}

.newsletter-content p {
    margin-bottom: var(--space-xl);
    color: var(--color-text);
}

.newsletter-form {
    display: flex;
    gap: var(--space-sm);
}

.newsletter-form .form-input {
    flex: 1;
}

.subscribe-message {
    margin-top: var(--space-md);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .newsletter-form {
        flex-direction: column;
    }
}
</style>
