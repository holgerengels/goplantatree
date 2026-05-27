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

    const hasItemPermission = (resource, action, item) => {
        const perms = permissions.value;
        if (!perms || !perms[resource]) return false;
        
        const scope = perms[resource][action];
        if (!scope || scope === 'none') return false;
        if (scope === 'all') return true;
        
        if (scope === 'own') {
            if (!user.value || !user.value.project) return false;
            
            const userProjId = typeof user.value.project === 'object'
                ? (user.value.project._id || user.value.project.id)
                : user.value.project;
                
            if (!userProjId) return false;
            
            if (resource === 'projects') {
                const itemId = item?._id || item?.id;
                return itemId && String(itemId) === String(userProjId);
            }
            
            if (item && item.project) {
                const itemProjId = typeof item.project === 'object'
                    ? (item.project._id || item.project.id)
                    : item.project;
                return itemProjId && String(itemProjId) === String(userProjId);
            }
            return false;
        }
        return false;
    };

    const setAuth = (t, u) => {
        token.value = t;
        user.value = u ? { ...u, permissions: permissions.value } : null;
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
                const userData = await res.json();
                user.value = { ...userData, permissions: permissions.value };
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

    return { token, user, isAuthenticated, permissions, hasPermission, hasItemPermission, login, logout, fetchMe, authHeaders };
});
