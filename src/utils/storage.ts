/**
 * Simple wrapper for Even Hub Bridge storage.
 * Keeps async signature to minimize refactoring.
 */
import { EvenAppBridge } from "@evenrealities/even_hub_sdk";

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        const bridge = await EvenAppBridge.getInstance();
        bridge.setLocalStorage(key, value);
    },
    getItem: async (key: string): Promise<string | null> => {
        const bridge = await EvenAppBridge.getInstance();
        return bridge.getLocalStorage(key);
    },
    removeItem: async (key: string): Promise<void> => {
        const bridge = await EvenAppBridge.getInstance();
        bridge.setLocalStorage(key, "");
    }
};
