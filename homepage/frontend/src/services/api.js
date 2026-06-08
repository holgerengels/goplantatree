const BASE_URL = '/api/v1';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Strips the /api/v1 prefix from a full URL if present.
 * Useful for endpoints coming from config (e.g. field.reference = "/api/v1/trees").
 */
const stripBase = (url) => url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url;

const handleResponse = async (res, errorMsg) => {
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || errorMsg);
        if (data.suggestion) {
            err.suggestion = data.suggestion;
        }
        throw err;
    }
    return res.json();
};

export const api = {
    async get(endpoint) {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Fehler beim Laden');
    },
    
    async download(endpoint) {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            headers: getHeaders()
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Fehler beim Herunterladen');
        }
        return res.blob();
    },
    
    async post(endpoint, data) {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Fehler beim Speichern');
    },

    async put(endpoint, data) {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Fehler beim Speichern');
    },

    async delete(endpoint, data) {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse(res, 'Fehler beim Löschen');
    },

    /**
     * Upload a FormData payload (multipart/form-data).
     * Does NOT set Content-Type — the browser sets it with the boundary.
     */
    async upload(endpoint, formData, method = 'POST') {
        const res = await fetch(`${BASE_URL}${stripBase(endpoint)}`, {
            method,
            headers: getAuthHeader(),
            body: formData
        });
        return handleResponse(res, 'Fehler beim Upload');
    }
};

