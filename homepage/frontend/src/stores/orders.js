import { defineStore } from 'pinia';
import { api } from '../services/api.js';

/**
 * Orders store — only used for submitting new orders from the OrderPage.
 * Admin order management goes through the generic EditorPage via fetch.
 */
export const useOrdersStore = defineStore('orders', () => {
    const submitOrder = async (orderData) => {
        try {
            return await api.post('/orders', orderData);
        } catch (err) {
            throw new Error(err.message || 'Bestellung fehlgeschlagen');
        }
    };

    return { submitOrder };
});
