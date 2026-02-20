/**
 * Simple wrapper for LocalStorage to replace Even Hub Bridge storage.
 * Keeps async signature to minimize refactoring.
 */

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        window.localStorage.setItem(key, value);
        return Promise.resolve();
    },
    getItem: async (key: string): Promise<string | null> => {
        return Promise.resolve(window.localStorage.getItem(key));
    },
    removeItem: async (key: string): Promise<void> => {
        window.localStorage.removeItem(key);
        return Promise.resolve();
    }
};
