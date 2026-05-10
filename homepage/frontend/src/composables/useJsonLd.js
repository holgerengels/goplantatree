import { onMounted, onUnmounted, watch } from 'vue';

export function useJsonLd(getData) {
    let scriptTag = null;

    const updateTag = () => {
        if (!document) return;
        
        const data = typeof getData === 'function' ? getData() : getData;
        if (!data) return;

        if (!scriptTag) {
            scriptTag = document.createElement('script');
            scriptTag.setAttribute('type', 'application/ld+json');
            scriptTag.id = 'json-ld-' + Math.random().toString(36).substr(2, 9);
            document.head.appendChild(scriptTag);
        }

        const ldData = {
            "@context": "https://schema.org",
            ...data
        };

        scriptTag.textContent = JSON.stringify(ldData);
    };

    onMounted(() => {
        updateTag();
    });

    if (typeof getData === 'function') {
        watch(getData, () => {
            updateTag();
        }, { deep: true });
    }

    onUnmounted(() => {
        if (scriptTag && scriptTag.parentNode) {
            scriptTag.parentNode.removeChild(scriptTag);
        }
    });
}
