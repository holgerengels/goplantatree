<template>
  <div class="dynamic-content" ref="contentEl">
    <template v-for="(block, idx) in parsedBlocks" :key="idx">
      <div v-if="block.type === 'html'" v-html="block.content" class="content-html"></div>
      
      <div v-else-if="block.type === 'macro'" class="macro-block">
        <component 
           v-if="resolveMacro(block.name)" 
           :is="resolveMacro(block.name)" 
           v-bind="block.props" 
        />
        <div v-else class="macro-error">
          <p>⚠️ Unbekanntes Makro: <code>[{{ block.name }}]</code></p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import MacroPosts from '../macros/MacroPosts.vue';
import MacroProjects from '../macros/MacroProjects.vue';
import MacroTrees from '../macros/MacroTrees.vue';
import MacroTimeline from '../macros/MacroTimeline.vue';
import MacroTeam from '../macros/MacroTeam.vue';
import MacroSponsors from '../macros/MacroSponsors.vue';
import MacroOfferings from '../macros/MacroOfferings.vue';
import MacroNewsletter from '../macros/MacroNewsletter.vue';
import MacroMedia from '../macros/MacroMedia.vue';

const props = defineProps({
    content: {
        type: String,
        default: ''
    }
});

const router = useRouter();
const contentEl = ref(null);

/**
 * Intercept clicks on <a> tags inside v-html content blocks
 * and route them through Vue Router for client-side navigation.
 */
const handleContentClick = (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip external links, anchors, mailto, tel, etc.
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Skip links that open in a new tab
    if (anchor.target === '_blank') return;

    e.preventDefault();

    // Resolve relative paths (e.g. ./baeume from /seite/baumwissen → /seite/baeume)
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
        'newsletter': MacroNewsletter,
        'media': MacroMedia
    };
    return macros[name] || null;
};

const parsedBlocks = computed(() => {
    const html = props.content || '';
    // Regex matches [[macroName key="val"]] or [macroName key="val"]
    const regex = /\[{1,2}([a-zA-Z0-9_-]+)(.*?)\]{1,2}/g;
    const blocks = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(html)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({ type: 'html', content: html.slice(lastIndex, match.index) });
        }
        
        const name = match[1];
        const propsStr = match[2];
        const macroProps = {};
        
        // Parse properties: key="value" or key='value' or key=value
        const propRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^ \t\r\n]+))/g;
        let propMatch;
        while ((propMatch = propRegex.exec(propsStr)) !== null) {
            const key = propMatch[1];
            let val = propMatch[2] ?? propMatch[3] ?? propMatch[4];
            
            // Convert numbers
            if (!isNaN(val) && val.trim() !== '') {
                val = Number(val);
            }
            // Convert booleans
            else if (val === 'true') val = true;
            else if (val === 'false') val = false;
            
            macroProps[key] = val;
        }

        blocks.push({ type: 'macro', name, props: macroProps });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < html.length) {
        blocks.push({ type: 'html', content: html.slice(lastIndex) });
    }

    return blocks;
});
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
