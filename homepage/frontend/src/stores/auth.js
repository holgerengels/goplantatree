import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const API = '/api/v1';

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || null);
    const user = ref(null);

    const isAuthenticated = computed(() => !!token.value);
    
    const permissions = computed(() => {
        if (!token.value) return {};
        try {
            const payload = JSON.parse(atob(token.value.split('.')[1]));
            return payload.permissions || {};
        } catch {
            return {};
        }
    });

    const hasPermission = (resource, action) => {
        const perms = permissions.value;
        if (!perms || !perms[resource]) return false;
        return perms[resource][action] && perms[resource][action] !== 'none';
    };

    const setAuth = (t, u) => {
        token.value = t;
        user.value = u;
        if (t) localStorage.setItem('token', t);
        else localStorage.removeItem('token');
    };

    const login = async (username, password) => {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Login fehlgeschlagen');
        }
        const data = await res.json();
        setAuth(data.token, data.user);
        return data;
    };

    const fetchMe = async () => {
        if (!token.value) return;
        try {
            const res = await fetch(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token.value}` }
            });
            if (res.ok) {
                user.value = await res.json();
            } else {
                setAuth(null, null);
            }
        } catch {
            setAuth(null, null);
        }
    };

    const logout = () => {
        setAuth(null, null);
    };

    const authHeaders = computed(() => ({
        Authorization: `Bearer ${token.value}`,
        'Content-Type': 'application/json'
    }));

    // Restore user on init
    if (token.value) fetchMe();

    return { token, user, isAuthenticated, permissions, hasPermission, login, logout, fetchMe, authHeaders };
});
