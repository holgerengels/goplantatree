<template>
  <div class="dynamic-content" ref="contentEl">
    <div v-html="processedHtml" class="content-html content"></div>
    
    <template v-if="isReadyForTeleport">
      <Teleport v-for="macro in macrosList" :key="macro.id" :to="`#${macro.id}`">
        <component 
           v-if="resolveMacro(macro.name)" 
           :is="resolveMacro(macro.name)" 
           v-bind="macro.props" 
           class="macro-block"
        />
        <div v-else class="macro-error">
          <p>⚠️ Unbekanntes Makro: <code>[{{ macro.name }}]</code></p>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { macroRegistry } from '../../utils/macroRegistry.js';

const MacroPosts = defineAsyncComponent(() => import('../macros/MacroPosts.vue'));
const MacroProjects = defineAsyncComponent(() => import('../macros/MacroProjects.vue'));
const MacroTrees = defineAsyncComponent(() => import('../macros/MacroTrees.vue'));
const MacroTimeline = defineAsyncComponent(() => import('../macros/MacroTimeline.vue'));
const MacroTeam = defineAsyncComponent(() => import('../macros/MacroTeam.vue'));
const MacroSponsors = defineAsyncComponent(() => import('../macros/MacroSponsors.vue'));
const MacroOfferings = defineAsyncComponent(() => import('../macros/MacroOfferings.vue'));
const MacroProjectAction = defineAsyncComponent(() => import('../macros/MacroProjectAction.vue'));
const MacroMedia = defineAsyncComponent(() => import('../macros/MacroMedia.vue'));
const MacroSubscribe = defineAsyncComponent(() => import('../macros/MacroSubscribe.vue'));
const MacroConfirm = defineAsyncComponent(() => import('../macros/MacroConfirm.vue'));
const MacroFields = defineAsyncComponent(() => import('../macros/MacroFields.vue'));

// Map registry names to actual Vue components
const macroComponents = {
    'posts': MacroPosts,
    'projects': MacroProjects,
    'trees': MacroTrees,
    'timeline': MacroTimeline,
    'team': MacroTeam,
    'sponsors': MacroSponsors,
    'offerings': MacroOfferings,
    'project-action': MacroProjectAction,
    'media': MacroMedia,
    'subscribe': MacroSubscribe,
    'confirm': MacroConfirm,
    'fields': MacroFields
};

const props = defineProps({
    content: {
        type: String,
        default: ''
    }
});

const router = useRouter();
const contentEl = ref(null);

const handleContentClick = (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (anchor.target === '_blank') return;

    e.preventDefault();

    const url = new URL(href, window.location.href);
    router.push(url.pathname + url.search);
};

onMounted(() => {
    contentEl.value?.addEventListener('click', handleContentClick);
});

onUnmounted(() => {
    contentEl.value?.removeEventListener('click', handleContentClick);
});

const resolveMacro = (name) => {
    // Only resolve names that exist in the registry
    if (!macroRegistry[name]) return null;
    return macroComponents[name] || null;
};

const processedHtml = ref('');
const macrosList = ref([]);
const isReadyForTeleport = ref(false);

watch(() => props.content, async (newContent) => {
    isReadyForTeleport.value = false;
    
    const html = newContent || '';
    const regex = /\[\[([a-zA-Z0-9_-]+)(.*?)\]\]/g;
    
    const newMacros = [];
    let counter = 0;
    
    // Replace all macros with placeholder DIVs
    const newHtml = html.replace(regex, (fullMatch, name, propsStr) => {
        const id = `macro-target-${Math.random().toString(36).substring(2, 9)}-${counter++}`;
        
        const macroProps = {};
        const propRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^ \t\r\n]+))/g;
        let propMatch;
        
        while ((propMatch = propRegex.exec(propsStr)) !== null) {
            const key = propMatch[1];
            let val = propMatch[2] ?? propMatch[3] ?? propMatch[4];
            
            if (!isNaN(val) && val.trim() !== '') {
                val = Number(val);
            } else if (val === 'true') {
                val = true;
            } else if (val === 'false') {
                val = false;
            }
            
            macroProps[key] = val;
        }
        
        newMacros.push({ id, name, props: macroProps });
        return `<div id="${id}" class="macro-placeholder"></div>`;
    });

    processedHtml.value = newHtml;
    macrosList.value = newMacros;
    
    // Wait for the v-html to be rendered to the DOM
    await nextTick();
    
    // Now the target divs exist, we can enable the Teleports
    isReadyForTeleport.value = true;
}, { immediate: true });
</script>

<style scoped>
.dynamic-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.macro-block {
    margin: var(--space-lg) 0;
    width: 100%;
}

.macro-error {
    background: rgba(255, 152, 0, 0.1);
    border: 1px dashed var(--color-warning);
    color: var(--color-warning);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
}

:deep(.content-html ul) {
    list-style-type: disc;
    margin-left: var(--space-xl);
    margin-bottom: var(--space-md);
}

:deep(.content-html ol) {
    list-style-type: decimal;
    margin-left: var(--space-xl);
    margin-bottom: var(--space-md);
}

:deep(.content-html li) {
    margin-bottom: var(--space-xs);
}
</style>
