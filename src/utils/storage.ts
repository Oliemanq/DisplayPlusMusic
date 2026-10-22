import { system } from '../capabilities/system';

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            const bridge = await system.getBridge();
            if (bridge) {
                await bridge.setLocalStorage(key, value);
            } else {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn('Storage setItem failed, falling back to localStorage:', e);
            window.localStorage.setItem(key, value);
        }
    },
    getItem: async (key: string): Promise<string | null> => {
        try {
            const bridge = await system.getBridge();
            if (bridge) {
                return await bridge.getLocalStorage(key);
            } else {
                return window.localStorage.getItem(key);
            }
        } catch (e) {
            console.warn('Storage getItem failed, falling back to localStorage:', e);
            return window.localStorage.getItem(key);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            const bridge = await system.getBridge();
            if (bridge) {
                await bridge.setLocalStorage(key, "");
            } else {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn('Storage removeItem failed, falling back to localStorage:', e);
            window.localStorage.removeItem(key);
        }
    }
};
