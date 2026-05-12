<template>
  <section class="hero" :style="heroStyle">
    <div class="hero-overlay"></div>
    <div class="hero-content container">
      <div class="hero-badge animate-fade-in" v-if="badge">
        <span class="badge badge-accent">{{ badge }}</span>
      </div>
      <h1 class="hero-title animate-fade-in-up">{{ title }}</h1>
      <p class="hero-subtitle animate-fade-in-up" v-if="subtitle" style="animation-delay: 0.15s">{{ subtitle }}</p>
      <div class="hero-actions animate-fade-in-up" v-if="$slots.actions" style="animation-delay: 0.3s">
        <slot name="actions"></slot>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    title: { type: String, required: true },
    subtitle: { type: String },
    badge: { type: String },
    backgroundImage: { type: String },
    height: { type: String, default: '70vh' }
});

const heroStyle = computed(() => ({
    minHeight: props.height,
    backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : undefined
}));
</script>

<style scoped>
.hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
    background-size: cover;
    background-position: center;
    background-color: var(--color-primary);
    overflow: hidden;
}

.hero-overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(30, 58, 44, 0.75) 0%, rgba(15, 30, 22, 0.9) 100%),
                url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E");
}

.hero-content {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: calc(var(--header-height) + var(--space-3xl)) var(--space-lg) var(--space-3xl);
}

.hero-badge {
    margin-bottom: var(--space-lg);
}

.hero-title {
    color: white;
    font-size: var(--text-6xl);
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: var(--space-lg);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
}

.hero-subtitle {
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--text-xl);
    max-width: 600px;
    margin: 0 auto var(--space-xl);
    line-height: 1.6;
}

.hero-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
    flex-wrap: wrap;
}

@media (max-width: 768px) {
    .hero-title {
        font-size: var(--text-4xl);
    }
    .hero-subtitle {
        font-size: var(--text-base);
    }
}
</style>
