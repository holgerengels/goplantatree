import { watch, onMounted, onUnmounted } from 'vue';

const SITE_NAME = 'Go Plant A Tree';
const DEFAULT_DESCRIPTION = 'Go Plant A Tree - Wir verschenken klimaresiliente Bäume für eine grünere Zukunft.';

/**
 * Reactive head tag management (title, meta, canonical).
 *
 * Usage:
 *   useHead(() => ({
 *       title: 'Mein Titel',
 *       description: 'Beschreibung der Seite',
 *       image: '/api/v1/media/by-slug/my-image/file',
 *       type: 'article',               // og:type — default 'website'
 *       canonicalPath: '/baeume/eiche', // optional, defaults to current path
 *   }));
 *
 * All fields are optional. Pass a reactive getter (function) so tags update
 * automatically when the underlying data changes.
 */
export function useHead(getData) {
    const managedTags = [];

    const ensureMeta = (attr, attrValue) => {
        let el = document.querySelector(`meta[${attr}="${attrValue}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, attrValue);
            document.head.appendChild(el);
            managedTags.push(el);
        }
        return el;
    };

    const ensureLink = (rel) => {
        let el = document.querySelector(`link[rel="${rel}"]`);
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
            managedTags.push(el);
        }
        return el;
    };

    const update = () => {
        const data = typeof getData === 'function' ? getData() : getData;
        if (!data) return;

        const title = data.title;
        const description = data.description || DEFAULT_DESCRIPTION;
        const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
        const url = data.canonicalPath
            ? `${window.location.origin}${data.canonicalPath}`
            : window.location.href;
        const ogType = data.type || 'website';

        // Resolve image to absolute URL
        let image = data.image || null;
        if (image && !image.startsWith('http')) {
            image = window.location.origin + image;
        }

        // Document title
        document.title = fullTitle;

        // Standard meta
        ensureMeta('name', 'description').setAttribute('content', description);

        // Open Graph
        ensureMeta('property', 'og:title').setAttribute('content', fullTitle);
        ensureMeta('property', 'og:description').setAttribute('content', description);
        ensureMeta('property', 'og:type').setAttribute('content', ogType);
        ensureMeta('property', 'og:url').setAttribute('content', url);
        ensureMeta('property', 'og:site_name').setAttribute('content', SITE_NAME);
        if (image) {
            ensureMeta('property', 'og:image').setAttribute('content', image);
        }

        // Twitter Card
        ensureMeta('name', 'twitter:card').setAttribute('content', image ? 'summary_large_image' : 'summary');
        ensureMeta('name', 'twitter:title').setAttribute('content', fullTitle);
        ensureMeta('name', 'twitter:description').setAttribute('content', description);
        if (image) {
            ensureMeta('name', 'twitter:image').setAttribute('content', image);
        }

        // Canonical
        ensureLink('canonical').setAttribute('href', url);
    };

    onMounted(update);

    if (typeof getData === 'function') {
        watch(getData, update, { deep: true });
    }

    // Clean up tags that we created (not pre-existing ones from index.html)
    onUnmounted(() => {
        for (const el of managedTags) {
            el.parentNode?.removeChild(el);
        }
        managedTags.length = 0;
        // Reset title
        document.title = SITE_NAME;
    });
}
