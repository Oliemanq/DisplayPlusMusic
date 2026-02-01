import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

// Wait for bridge initialization
const bridge = await waitForEvenAppBridge();

// Get user information
const user = await bridge.getUserInfo();
console.log('User:', user.name);

// Get device information
const device = await bridge.getDeviceInfo();
console.log('Device Model:', device?.model);

