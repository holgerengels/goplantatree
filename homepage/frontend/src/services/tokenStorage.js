/**
 * Centralized token storage.
 * Both the auth store and the API service use this module to access the JWT token,
 * ensuring the storage mechanism is defined in a single place.
 */

const TOKEN_KEY = 'token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}
