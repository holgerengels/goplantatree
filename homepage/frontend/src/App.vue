<template>
  <div class="app">
    <AppHeader v-if="!isAdminRoute" />
    <main class="app-main">
      <router-view />
    </main>
    <AppFooter v-if="!isAdminRoute" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './components/layout/AppHeader.vue';
import AppFooter from './components/layout/AppFooter.vue';

const route = useRoute();
const isAdminRoute = computed(() => route.path.startsWith('/admin'));
</script>

<style>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
.app-main {
    flex: 1;
}
</style>
