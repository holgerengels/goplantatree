<template>
  <div class="timeline-container">
    <div class="timeline-line"></div>
    <div 
      v-for="(item, index) in items" 
      :key="index" 
      :class="['timeline-item', item.status || 'upcoming']"
      :style="{ animationDelay: `${index * 0.15}s` }"
    >
      <div class="timeline-dot">
        <span v-if="item.status === 'done'" class="dot-icon">✓</span>
        <span v-else-if="item.status === 'active'" class="dot-icon dot-pulse">●</span>
        <span v-else class="dot-icon">○</span>
      </div>
      <div class="timeline-content card">
        <span class="timeline-date badge badge-primary">{{ formatDate(item.date) }}</span>
        <h4>{{ item.label }}</h4>
        <p v-if="item.description">{{ item.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatDateLong as formatDate } from '../../utils/format.js';

defineProps({
    items: { type: Array, default: () => [] }
});
</script>

<style scoped>
.timeline-container {
    position: relative;
    padding-left: 40px;
    max-width: 700px;
    margin: 0 auto;
}

.timeline-line {
    position: absolute;
    left: 20px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, var(--color-accent), var(--color-primary), var(--color-border));
}

.timeline-item {
    position: relative;
    margin-bottom: var(--space-xl);
    animation: fadeInUp 0.5s ease forwards;
    opacity: 0;
}

.timeline-dot {
    position: absolute;
    left: -33px;
    top: 20px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 3px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    font-size: var(--text-xs);
}

.timeline-item.done .timeline-dot {
    background: var(--color-success);
    border-color: var(--color-success);
    color: white;
}

.timeline-item.active .timeline-dot {
    background: var(--color-accent);
    border-color: var(--color-accent-dark);
    color: var(--color-primary-dark);
}

.dot-pulse {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.timeline-content {
    padding: var(--space-lg) !important;
}
.timeline-content:hover {
    transform: none;
}

.timeline-date {
    margin-bottom: var(--space-sm);
}

.timeline-content h4 {
    margin: var(--space-sm) 0 var(--space-xs);
    color: var(--color-primary-dark);
}

.timeline-content p {
    font-size: var(--text-sm);
    margin: 0;
}
</style>
