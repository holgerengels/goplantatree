<template>
  <nav class="section-nav-wrapper" v-if="sections.length >= 2" aria-label="Abschnittsnavigation">
    <div class="section-nav-container">
      <button
        v-for="sec in sections"
        :key="sec.id"
        :class="['section-nav-item', { active: activeId === sec.id }]"
        @click="scrollTo(sec.id)"
      >
        {{ sec.label }}
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    targetSelector: {
        type: String,
        default: '.content-html'
    },
    contentWatch: {
        type: String,
        default: ''
    }
});

const sections = ref([]);
const activeId = ref('');
let observer = null;

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const buildNav = () => {
    const container = document.querySelector(props.targetSelector);
    if (!container) {
        sections.value = [];
        return;
    }

    // Find all sections or block containers inside target
    const sectionEls = container.querySelectorAll('section, .section');
    const items = [];
    const usedIds = new Set();

    sectionEls.forEach((sec, idx) => {
        const heading = sec.querySelector('h2, h3, .block-title h2, .block-title h3');
        if (!heading) return;

        const label = heading.textContent.trim();
        if (!label || label.length < 2) return;

        let id = sec.id || heading.id;
        if (!id) {
            let candidate = slugify(label);
            if (!candidate) candidate = `section-${idx + 1}`;
            if (usedIds.has(candidate)) {
                let count = 2;
                while (usedIds.has(`${candidate}-${count}`)) count++;
                candidate = `${candidate}-${count}`;
            }
            sec.id = candidate;
            id = candidate;
        }

        usedIds.add(id);
        items.push({ id, label, el: sec });
    });

    sections.value = items;

    if (items.length > 0 && !activeId.value) {
        activeId.value = items[0].id;
    }

    setupObserver();
};

const setupObserver = () => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    if (sections.value.length < 2) return;

    observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                activeId.value = entry.target.id;
            }
        });
    }, {
        rootMargin: '-80px 0px -65% 0px',
        threshold: 0
    });

    sections.value.forEach(sec => {
        if (sec.el) observer.observe(sec.el);
    });
};

const scrollTo = (id) => {
    activeId.value = id;
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
};

onMounted(async () => {
    await nextTick();
    // Allow macro teleports to settle
    setTimeout(buildNav, 150);
});

watch(() => props.contentWatch, async () => {
    await nextTick();
    setTimeout(buildNav, 200);
});

onUnmounted(() => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
});
</script>

<style scoped>
.section-nav-wrapper {
    position: sticky;
    top: var(--header-height);
    z-index: 90;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--color-border-light);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}

.section-nav-container {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 var(--space-lg);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    height: 48px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
}

.section-nav-container::-webkit-scrollbar {
    display: none;
}

.section-nav-item {
    display: inline-flex;
    align-items: center;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    white-space: nowrap;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
}

.section-nav-item:hover {
    color: var(--color-primary-dark);
    background: var(--color-bg-alt);
}

.section-nav-item.active {
    color: var(--color-primary-dark);
    background: var(--color-primary-50);
    border-color: rgba(46, 86, 65, 0.2);
    font-weight: 600;
}

@media (max-width: 768px) {
    .section-nav-container {
        padding: 0 var(--space-md);
        height: 42px;
    }

    .section-nav-item {
        padding: 4px 10px;
        font-size: var(--text-xs);
    }
}
</style>
