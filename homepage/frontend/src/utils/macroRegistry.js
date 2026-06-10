/**
 * Central macro registry – single source of truth for all available macros.
 * Used by DynamicContent (rendering) and FormField (editor help).
 */

export const macroRegistry = {
    posts: {
        label: 'Blog-Beiträge',
        props: [
            { name: 'limit', type: 'Number', default: 3, desc: 'Max. Anzahl' },
            { name: 'type', type: 'String', default: '', desc: "z.B. 'news' oder 'pflanzung'" },
            { name: 'title', type: 'String', default: '', desc: 'Überschrift' },
            { name: 'subtitle', type: 'String', default: '', desc: 'Unterzeile' },
            { name: 'theme', type: 'String', default: '', desc: "z.B. 'alt', 'surface', 'primary'" }
        ],
        example: '[[posts limit=3 type="news"]]'
    },
    projects: {
        label: 'Projekte',
        props: [
            { name: 'limit', type: 'Number', default: 3, desc: 'Max. Anzahl' },
            { name: 'activeOnly', type: 'Boolean', default: false, desc: 'Nur aktive Projekte' },
            { name: 'title', type: 'String', default: '', desc: 'Überschrift' },
            { name: 'subtitle', type: 'String', default: '', desc: 'Unterzeile' },
            { name: 'theme', type: 'String', default: '', desc: "z.B. 'alt', 'surface'" }
        ],
        example: '[[projects limit=3 activeOnly=true]]'
    },
    trees: {
        label: 'Baumkatalog',
        props: [
            { name: 'category', type: 'String', default: '', desc: 'Filter nach Kategorie' },
            { name: 'limit', type: 'Number', default: 0, desc: 'Max. Anzahl (0 = alle)' }
        ],
        example: '[[trees category="Laubbaum"]]'
    },
    timeline: {
        label: 'Zeitstrahl',
        props: [
            { name: 'project', type: 'String', required: true, desc: 'Projekt-Slug' },
            { name: 'title', type: 'String', default: 'Zeitstrahl', desc: 'Überschrift' },
            { name: 'subtitle', type: 'String', default: '', desc: 'Unterzeile' }
        ],
        example: '[[timeline project="mein-projekt"]]'
    },
    team: {
        label: 'Team-Anzeige',
        props: [
            { name: 'project', type: 'String', required: true, desc: 'Projekt-Slug' },
            { name: 'title', type: 'String', default: 'Unser Team', desc: 'Überschrift' }
        ],
        example: '[[team project="mein-projekt"]]'
    },
    sponsors: {
        label: 'Sponsoren',
        props: [
            { name: 'project', type: 'String', required: true, desc: 'Projekt-Slug' },
            { name: 'title', type: 'String', default: 'Partner & Sponsoren', desc: 'Überschrift' }
        ],
        example: '[[sponsors project="mein-projekt"]]'
    },
    offerings: {
        label: 'Angebote / Bäume bestellen',
        props: [
            { name: 'project', type: 'String', required: true, desc: 'Projekt-Slug' },
            { name: 'title', type: 'String', default: 'Verfügbare Bäume', desc: 'Überschrift' }
        ],
        example: '[[offerings project="mein-projekt"]]'
    },
    'project-action': {
        label: 'Projekt-Aktionsbutton',
        props: [
            { name: 'project', type: 'String', required: true, desc: 'Projekt-Slug' }
        ],
        example: '[[project-action project="mein-projekt"]]'
    },
    media: {
        label: 'Medien einbetten',
        props: [
            { name: 'id', type: 'String', required: true, desc: 'Slug oder ID des Mediums' },
            { name: 'align', type: 'String', default: 'center', desc: "'left', 'right' oder 'center'" },
            { name: 'showCaption', type: 'Boolean', default: true, desc: 'Bildunterschrift anzeigen' },
            { name: 'autoplay', type: 'Boolean', default: false, desc: 'Video automatisch abspielen' },
            { name: 'loop', type: 'Boolean', default: false, desc: 'Video wiederholen' },
            { name: 'muted', type: 'Boolean', default: false, desc: 'Video stumm' }
        ],
        example: '[[media id="mein-bild" align="left"]]'
    },
    subscribe: {
        label: 'Newsletter-Anmeldung',
        props: [
            { name: 'topic', type: 'String', default: 'general', desc: 'Newsletter-Thema' },
            { name: 'project', type: 'String', default: '', desc: 'Projekt-Slug' }
        ],
        example: '[[subscribe topic="general"]]'
    },
    confirm: {
        label: 'E-Mail-Bestätigung',
        props: [],
        example: '[[confirm]]'
    }
};

/**
 * Returns sorted array of [name, definition] entries.
 */
export const getMacroList = () =>
    Object.entries(macroRegistry).sort(([a], [b]) => a.localeCompare(b));
