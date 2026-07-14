import { EvenAppBridge, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

let bridgePromise: Promise<EvenAppBridge | null> | null = null;

function getBridge(): Promise<EvenAppBridge | null> {
    if (!bridgePromise) {
        bridgePromise = withTimeout(waitForEvenAppBridge(), 1000, null);
    }
    return bridgePromise;
}

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            const bridge = await getBridge();
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
            const bridge = await getBridge();
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
            const bridge = await getBridge();
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
