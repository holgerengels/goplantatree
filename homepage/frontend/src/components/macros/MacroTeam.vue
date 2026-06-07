<template>
  <section class="macro-team" v-if="sortedMembers.length">
    <div class="section-title">
      <h2>{{ title }}</h2>
    </div>
    <div class="team-grid">
      <div v-for="member in sortedMembers" :key="member.name" class="team-card card">
        <img v-if="member.avatar && member.avatar.url" :src="member.avatar.url + '?v=thumb'" :alt="member.name" class="team-avatar team-avatar-img" />
        <div v-else class="team-avatar">{{ member.name.charAt(0) }}</div>
        <div class="team-info">
          <h4>{{ member.name }}</h4>
          <p class="team-role">{{ member.role }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectContent } from '../../composables/useProjectContent.js';

const props = defineProps({
    project: { type: String, required: true },
    title: { type: String, default: 'Unser Team' }
});

const members = useProjectContent(() => props.project, 'team');

const sortedMembers = computed(() =>
    [...members.value].sort((a, b) => a.name.localeCompare(b.name, 'de'))
);
</script>

<style scoped>
.macro-team { background: var(--color-bg-alt); padding: var(--space-2xl) 0; border-radius: var(--radius-lg); }
.section-title { text-align: center; margin-bottom: var(--space-2xl); }
.team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md);
    margin: 0 auto;
    padding: 0 var(--space-lg);
}
.team-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) !important;
}
.team-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    color: white; font-size: var(--text-xl); font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.team-avatar-img {
    object-fit: cover;
    background: none;
}
.team-info {
    min-width: 0;
}
.team-card h4 { margin: 0; font-size: var(--text-base); }
.team-role { font-size: var(--text-sm); color: var(--color-text-muted); margin: 0!important; }
</style>
