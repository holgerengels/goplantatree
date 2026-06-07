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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import MacroPosts from '../macros/MacroPosts.vue';
import MacroProjects from '../macros/MacroProjects.vue';
import MacroTrees from '../macros/MacroTrees.vue';
import MacroTimeline from '../macros/MacroTimeline.vue';
import MacroTeam from '../macros/MacroTeam.vue';
import MacroSponsors from '../macros/MacroSponsors.vue';
import MacroOfferings from '../macros/MacroOfferings.vue';
import MacroProjectAction from '../macros/MacroProjectAction.vue';
import MacroMedia from '../macros/MacroMedia.vue';
import MacroSubscribe from '../macros/MacroSubscribe.vue';
import MacroConfirm from '../macros/MacroConfirm.vue';

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

    const resolved = new URL(href, window.location.href).pathname;
    router.push(resolved);
};

onMounted(() => {
    contentEl.value?.addEventListener('click', handleContentClick);
});

onUnmounted(() => {
    contentEl.value?.removeEventListener('click', handleContentClick);
});

const resolveMacro = (name) => {
    const macros = {
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
        'confirm': MacroConfirm
    };
    return macros[name] || null;
};

const processedHtml = ref('');
const macrosList = ref([]);
const isReadyForTeleport = ref(false);

watch(() => props.content, async (newContent) => {
    isReadyForTeleport.value = false;
    
    const html = newContent || '';
    const regex = /\[{1,2}([a-zA-Z0-9_-]+)(.*?)\]{1,2}/g;
    
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
