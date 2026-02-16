function generateRefreshToken() {
    const http = require('http');
    const crypto = require('crypto');
    const { exec } = require('child_process');

    const CLIENT_ID = '29a961338df9480db3c1b50e10df184f'; // Your Client ID
    const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
    const SCOPES = 'user-modify-playback-state user-read-playback-state';

    // PKCE Helpers
    function base64URLEncode(str) {
        return str.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    function sha256(buffer) {
        return crypto.createHash('sha256').update(buffer).digest();
    }

    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');
            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<h1>Success! Check your terminal for the Refresh Token.</h1>');

                // Exchange code for token
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
                        console.log(data.refresh_token);
                        return data.refresh_token;
                    } else {
                        console.error('Error: No refresh token received.', data);
                        process.exit(1);
                    }
                } catch (err) {
                    console.error('Error exchanging token:', err);
                    process.exit(1);
                }
            }
        }
    });

    server.listen(8888, () => {
        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;

        console.log(`Server running at http://127.0.0.1:8888`);
        console.log(`If browser doesn't open, visit: ${authUrl}`);

        // Open browser
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        exec(`${start} "${authUrl}"`);
    });
}
generateRefreshToken();

export { generateRefreshToken };