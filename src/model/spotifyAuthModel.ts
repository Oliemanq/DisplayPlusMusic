import { sha256 } from "../Scripts/sha256";
import { storage } from '../utils/storage';

class SpotifyAuthModel {



    CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENTID; // Ensure this is set in your .env
    REDIRECT_URI = 'https://httpbin.org/get'; // Using httpbin to easily copy code on mobile
    SCOPES = 'user-modify-playback-state user-read-playback-state';

    /**
     * Generates a random string for PKCE code verifier
     */
    generateRandomString(length: number): string {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        array = array.map(x => validChars.charCodeAt(x % validChars.length));
        return String.fromCharCode.apply(null, Array.from(array));
    }

    /**
     * Encodes a buffer to Base64 Url Safe string
     */
    base64UrlEncode(a: ArrayBuffer): string {
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
    async generateCodeChallenge(codeVerifier: string): Promise<string> {
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
            return this.base64UrlEncode(digest);
        } else {
            // Fallback to pure JS implementation for insecure contexts
            console.warn("Secure context not detected (crypto.subtle undefined). Using JS SHA-256 fallback.");
            const digest = sha256(codeVerifier); // Returns Uint8Array
            return this.base64UrlEncode(digest.buffer as ArrayBuffer);
        }
    }

    /**
     * Initiates the PKCE Auth Flow by redirecting the user to Spotify
     */

    async generateURL(): Promise<URL> {
        const codeVerifier = this.generateRandomString(128);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        console.log("generateURL passed generateRandomString and generateCodeChallenge");

        // Store the verifier for the callback
        await storage.setItem('spotify_code_verifier', codeVerifier);

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const params = {
            response_type: 'code',
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            redirect_uri: this.REDIRECT_URI,
        };

        authUrl.search = new URLSearchParams(params).toString();
        return authUrl;
    }

    async generateRefreshToken(authUrl: URL): Promise<void> {
        // open in new tab
        window.open(authUrl.toString(), '_blank');
    }

    /**
     * Exchanges an auth code for a refresh token
     */
    async exchangeCodeForToken(code: string): Promise<string | null> {
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
                    client_id: this.CLIENT_ID,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.REDIRECT_URI,
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
    async checkForAuthCode(): Promise<string | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) return null;

        // Clean the URL
        window.history.replaceState({}, document.title, "/");

        return await this.exchangeCodeForToken(code);
    }


}

const spotifyAuthModel = new SpotifyAuthModel();
export default spotifyAuthModel;
