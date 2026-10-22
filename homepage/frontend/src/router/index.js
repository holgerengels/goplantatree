import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../services/tokenStorage.js';
import HomePage from '../pages/HomePage.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomePage,
        meta: { hero: true }
    },

    // Login
    {
        path: '/login',
        name: 'login',
        component: () => import('../pages/LoginPage.vue')
    },

    {
        path: '/bestellen/:projectSlug',
        name: 'order',
        component: () => import('../pages/OrderPage.vue'),
        meta: { hero: true }
    },

    {
        path: '/mitmachen/:projectSlug',
        name: 'action-mitmachen',
        component: () => import('../pages/ActionPage.vue'),
        meta: { hero: true }
    },

    {
        path: '/anmelden/:projectSlug',
        name: 'action-anmelden',
        component: () => import('../pages/ActionPage.vue'),
        meta: { hero: true }
    },

    {
        path: '/abmelden/:token',
        name: 'unsubscribe',
        component: () => import('../pages/UnsubscribePage.vue'),
        meta: { hero: true }
    },

    {
        path: '/bestaetigen/:token',
        name: 'confirm',
        component: () => import('../pages/ContentPage.vue'),
        meta: { hero: true },
        props: { pageSlugOverride: 'bestaetigen' }
    },

    // Static content pages
    {
        path: '/seite/:slug',
        name: 'content',
        component: () => import('../pages/ContentPage.vue')
    },

    {
        path: '/projekt/:slug',
        name: 'project',
        component: () => import('../pages/ContentPage.vue'),
        meta: { hero: true },
        props: route => ({ pageSlugOverride: `projekt-${route.params.slug}` })
    },

    // Admin — Dashboard
    {
        path: '/admin',
        name: 'admin',
        component: () => import('../pages/admin/DashboardPage.vue'),
        meta: { requiresAuth: true }
    },

    // Admin — Newsletter
    {
        path: '/admin/newsletter',
        name: 'admin-newsletter',
        component: () => import('../pages/admin/NewsletterPage.vue'),
        meta: { requiresAuth: true }
    },

    // Admin — Changelog (dedicated read-only view)
    {
        path: '/admin/aenderungslog',
        name: 'admin-changelog',
        component: () => import('../pages/admin/ChangelogPage.vue'),
        meta: { requiresAuth: true }
    },

    // Admin — Generic entity editor
    {
        path: '/admin/:entity',
        name: 'admin-editor',
        component: () => import('../pages/admin/AdminEditorPage.vue'),
        meta: { requiresAuth: true }
    },

    // Generic entity detail (public) — rendered from template Page "detail-<entity>"
    {
        path: '/:entity/:id',
        name: 'entity-detail',
        component: () => import('../pages/ContentPage.vue'),
        props: true
    },

    // Generic scoped entity detail (slug only unique within scope, e.g. offerings per project)
    {
        path: '/:entity/:scope/:id',
        name: 'entity-detail-scoped',
        component: () => import('../pages/ContentPage.vue'),
        props: true
    },

    // 404 catch-all (must be last)
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../pages/ContentPage.vue'),
        props: { pageSlugOverride: '404' }
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) return savedPosition;
        return { top: 0 };
    }
});

// Navigation guard for admin routes
router.beforeEach((to, from, next) => {
    if (to.meta.requiresAuth) {
        const token = getToken();
        if (!token) {
            return next({ name: 'login', query: { redirect: to.fullPath } });
        }
    }
    next();
});

export default router;
