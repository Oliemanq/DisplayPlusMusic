import { sha256 } from './sha256';
import { storage } from '../utils/storage';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENTID; // Ensure this is set in your .env
const REDIRECT_URI = 'https://httpbin.org/get'; // Using httpbin to easily copy code on mobile
const SCOPES = 'user-modify-playback-state user-read-playback-state';

/**
 * Generates a random string for PKCE code verifier
 */
function generateRandomString(length: number): string {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    array = array.map(x => validChars.charCodeAt(x % validChars.length));
    return String.fromCharCode.apply(null, Array.from(array));
}

/**
 * Encodes a buffer to Base64 Url Safe string
 */
function base64UrlEncode(a: ArrayBuffer): string {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Generates the PKCE code challenge from the verifier
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    /*
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(digest);
    */

    // Use Web Crypto API if available (Secure Context)
    if (window.crypto && window.crypto.subtle) {
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest("SHA-256", data);
        return base64UrlEncode(digest);
    } else {
        // Fallback to pure JS implementation for insecure contexts
        console.warn("Secure context not detected (crypto.subtle undefined). Using JS SHA-256 fallback.");
        const digest = sha256(codeVerifier); // Returns Uint8Array
        return base64UrlEncode(digest.buffer as ArrayBuffer);
    }
}

/**
 * Initiates the PKCE Auth Flow by redirecting the user to Spotify
 */
async function generateRefreshToken(): Promise<void> {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store the verifier for the callback
    await storage.setItem('spotify_code_verifier', codeVerifier);

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    const params = {
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: REDIRECT_URI,
    };

    authUrl.search = new URLSearchParams(params).toString();
    // open in new tab
    window.open(authUrl.toString(), '_blank');
}

/**
 * Exchanges an auth code for a refresh token
 */
async function exchangeCodeForToken(code: string): Promise<string | null> {
    const codeVerifier = await storage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
        console.error("No code verifier found in storage. Auth flow might be stale.");
        return null;
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });

        const data = await response.json();

        if (data.refresh_token) {
            // Clear the verifier
            await storage.setItem('spotify_code_verifier', "");
            return data.refresh_token;
        } else {
            console.error('Error exchanging token:', data);
            return null;
        }
    } catch (err) {
        console.error('Network error exchanging token:', err);
        return null;
    }
}

/**
 * Checks the URL for an auth code and exchanges it for tokens
 * Returns the Refresh Token if successful, or null if no code found/error
 */
async function checkForAuthCode(): Promise<string | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) return null;

    // Clean the URL
    window.history.replaceState({}, document.title, "/");

    return await exchangeCodeForToken(code);
}

export { checkForAuthCode, generateRefreshToken, exchangeCodeForToken }