<template>
  <section class="macro-team" v-if="members.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
    </div>
    <div class="team-grid">
      <div v-for="member in members" :key="member.name" class="team-card card">
        <img v-if="member.avatar && member.avatar.url" :src="member.avatar.url" :alt="member.name" class="team-avatar team-avatar-img" />
        <div v-else class="team-avatar">{{ member.name.charAt(0) }}</div>
        <h4>{{ member.name }}</h4>
        <p class="team-role">{{ member.role }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Unser Team' }
});

const members = ref([]);

watch(() => props.project, async (newVal) => {
    if (!newVal) return;
    try {
        const project = await api.get(`/projects/${newVal}`);
        members.value = project?.content?.team || [];
    } catch { /* empty */ }
}, { immediate: true });
</script>

<style scoped>
.macro-team { background: var(--color-bg-alt); padding: var(--space-2xl) 0; border-radius: var(--radius-lg); }
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-xl);
    margin: 0 auto;
    padding: 0 var(--space-lg);
}
.team-card { text-align: center; }
.team-avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    color: white; font-size: var(--text-2xl); font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto var(--space-md);
}
.team-avatar-img {
    object-fit: cover;
    background: none;
}
.team-card h4 { margin-bottom: var(--space-xs); }
.team-role { font-size: var(--text-sm); color: var(--color-text-muted); margin: 0; }
</style>
