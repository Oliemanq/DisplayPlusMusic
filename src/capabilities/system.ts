import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk';

/**
 * A robust timeout helper.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), ms);
    });

    return Promise.race([
        promise.then((val) => {
            clearTimeout(timeoutId);
            return val;
        }),
        timeoutPromise,
    ]);
}

let bridgePromise: Promise<EvenAppBridge | null> | null = null;

async function getBridge(): Promise<EvenAppBridge | null> {
    if (!bridgePromise) {
        // We use a slightly longer timeout for initial bridge acquisition
        bridgePromise = withTimeout(waitForEvenAppBridge(), 3000, null);
    }
    return bridgePromise;
}

/**
 * System-level capabilities (e.g. bridge, device info, etc.)
 */
export const System = {
    async getBridge(): Promise<EvenAppBridge | null> {
        return getBridge();
    },

    getBluetoothDelay(): number {
        return 0.1;
    },

    /**
     * A robust timeout helper for bridge operations.
     */
    async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
        return withTimeout(promise, ms, fallback);
    },

    /**
     * Initializes system services.
     */
    async init() {
        // Currently just ensures bridge is ready or at least attempted
        await getBridge();
    }
};

export const system = System;
