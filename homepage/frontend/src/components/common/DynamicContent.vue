<template>
  <div class="dynamic-content">
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
import { computed } from 'vue';
import MacroPosts from '../macros/MacroPosts.vue';
import MacroProjects from '../macros/MacroProjects.vue';
import MacroTrees from '../macros/MacroTrees.vue';
import MacroTimeline from '../macros/MacroTimeline.vue';
import MacroTeam from '../macros/MacroTeam.vue';
import MacroSponsors from '../macros/MacroSponsors.vue';
import MacroOfferings from '../macros/MacroOfferings.vue';
import MacroNewsletter from '../macros/MacroNewsletter.vue';

const props = defineProps({
    content: {
        type: String,
        default: ''
    }
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
        'newsletter': MacroNewsletter
    };
    return macros[name] || null;
};

const parsedBlocks = computed(() => {
    const html = props.content || '';
    // Regex matches [macroName key="val" key2="val"] or just [macroName]
    // The macro name is group 1, the props string is group 2.
    // Also ignores [ inside pre/code blocks if possible, but for simplicity we just match global.
    const regex = /\[([a-zA-Z0-9_-]+)(.*?)\]/g;
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
</style>
