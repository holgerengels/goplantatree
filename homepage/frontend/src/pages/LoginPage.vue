<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card card">
        <div class="login-header">
          <img src="/images/logo-notext.svg" alt="Logo" class="login-logo" />
          <h2>Admin Login</h2>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label">Benutzername</label>
            <input v-model="username" type="text" class="form-input" required autofocus />
          </div>
          <div class="form-group">
            <label class="form-label">Passwort</label>
            <input v-model="password" type="password" class="form-input" required />
          </div>
          <p v-if="error" class="form-error">{{ error }}</p>
          <button type="submit" class="btn btn-primary btn-lg login-btn" :disabled="loading">
            {{ loading ? 'Anmelden …' : 'Anmelden' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleLogin = async () => {
    loading.value = true;
    error.value = '';
    try {
        await auth.login(username.value, password.value);
        const redirect = route.query.redirect || '/admin';
        router.push(redirect);
    } catch (err) {
        error.value = err.message;
    } finally {
        loading.value = false;
    }
};
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
    padding: var(--space-lg);
}

.login-card {
    width: 100%;
    max-width: 400px;
    padding: var(--space-2xl) !important;
}

.login-header {
    text-align: center;
    margin-bottom: var(--space-xl);
}

.login-logo {
    width: 64px;
    margin: 0 auto var(--space-md);
}

.login-btn {
    width: 100%;
    margin-top: var(--space-md);
}

.form-error {
    text-align: center;
}
</style>
