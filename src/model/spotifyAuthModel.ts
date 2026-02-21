import { storage } from '../utils/storage';

class SpotifyAuthModel {
    // Generate the redirect URI dynamically to match EXACTLY what's in the address bar (minus query parameters)
    // This handles both `http://100.x.x.x:5173/` and `https://oliemanq.github.io/DisplayPlusMusic/`
    REDIRECT_URI = window.location.protocol + "//" + window.location.host + window.location.pathname;
    SCOPES = 'user-modify-playback-state user-read-playback-state';

    /**
     * Generates a random string for state parameter
     */
    generateRandomString(length: number): string {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        array = array.map(x => validChars.charCodeAt(x % validChars.length));
        return String.fromCharCode.apply(null, Array.from(array));
    }

    /**
     * Initiates the Auth Flow by redirecting the user to Spotify
     */
    async generateAuthUrl(clientId: string): Promise<void> {
        const state = this.generateRandomString(16);
        await storage.setItem('spotify_auth_state', state);

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const params = {
            response_type: 'code',
            client_id: clientId,
            scope: this.SCOPES,
            redirect_uri: this.REDIRECT_URI,
            state: state,
        };

        authUrl.search = new URLSearchParams(params).toString();
        // Redirect the whole page
        window.location.href = authUrl.toString();
    }

    /**
     * Exchanges an auth code for a refresh token
     */
    async exchangeCodeForToken(code: string, clientId: string, clientSecret: string): Promise<any | null> {
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.REDIRECT_URI,
                }),
            });

            const data = await response.json();

            if (data.refresh_token && data.access_token) {
                return data;
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
     * Returns the token data if successful, or null if no code found/error
     */
    async checkForAuthCode(): Promise<any | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) return null;

        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);

        const savedState = await storage.getItem('spotify_auth_state');
        if (state !== savedState) {
            console.error("State mismatch");
            return null;
        }
        await storage.removeItem('spotify_auth_state');

        const clientId = await storage.getItem('spotify_client_id');
        const clientSecret = await storage.getItem('spotify_client_secret');

        if (!clientId || !clientSecret) return null;

        return await this.exchangeCodeForToken(code, clientId, clientSecret);
    }
}

const spotifyAuthModel = new SpotifyAuthModel();
export default spotifyAuthModel;
