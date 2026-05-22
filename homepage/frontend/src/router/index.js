import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'home',
        component: () => import('../pages/HomePage.vue'),
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

    // Admin — Generic entity editor
    {
        path: '/admin/:entity',
        name: 'admin-editor',
        component: () => import('../pages/admin/AdminEditorPage.vue'),
        meta: { requiresAuth: true }
    },

    // Generic entity detail (public)
    {
        path: '/:entity/:id',
        name: 'entity-detail',
        component: () => import('../pages/DetailPage.vue')
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
        const token = localStorage.getItem('token');
        if (!token) {
            return next({ name: 'login', query: { redirect: to.fullPath } });
        }
    }
    next();
});

// Reset page title on navigation; pages override once data loads
router.afterEach(() => {
    document.title = 'Go Plant A Tree';
});

export default router;
