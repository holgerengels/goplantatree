<template>
  <div class="macro-subscribe">
    <div class="subscribe-box">
      <div class="subscribe-content">
        <h2>🌱 Bleib auf dem Laufenden</h2>
        <p>Erfahre als Erste*r, wann die nächste Aktion startet.</p>
      </div>
      <form class="subscribe-form" @submit.prevent="subscribe">
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
    thema: {
        type: String,
        default: 'general'
    },
    projekt: {
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
            topic: props.thema
        };

        if (props.projekt) {
            payload.project = props.projekt;
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
.macro-subscribe {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-bg));
    padding: var(--space-2xl) var(--space-md);
    border-radius: var(--radius-xl);
    margin: var(--space-2xl) 0;
}

.subscribe-box {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
}

.subscribe-content h2 {
    margin-bottom: var(--space-sm);
    color: var(--color-primary-dark);
}

.subscribe-content p {
    margin-bottom: var(--space-xl);
    color: var(--color-text);
}

.subscribe-form {
    display: flex;
    gap: var(--space-sm);
}

.subscribe-form .form-input {
    flex: 1;
}

.subscribe-message {
    margin-top: var(--space-md);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .subscribe-form {
        flex-direction: column;
    }
}
</style>
