/**
 * Simple wrapper for LocalStorage to replace Even Hub Bridge storage.
 * Keeps async signature to minimize refactoring.
 */

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage.setItem failed:', e);
        }
        return Promise.resolve();
    },
    getItem: async (key: string): Promise<string | null> => {
        try {
            return Promise.resolve(window.localStorage.getItem(key));
        } catch (e) {
            console.warn('localStorage.getItem failed:', e);
            return Promise.resolve(null);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage.removeItem failed:', e);
        }
        return Promise.resolve();
    }
};
