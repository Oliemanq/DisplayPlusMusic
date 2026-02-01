const SpotifyWebApi = require('spotify-web-api-node');

const open = require('open');
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const PORT = 8888;
const SCOPE = 'user-modify-playback-state user-read-playback-state';

const spotifyApi = new SpotifyWebApi({
  clientId: '',
  clientSecret: '',
  refreshToken: ''
});

function getSpotifyApiInstance() {
    return spotifyApi;
}
function setClientID(clientId) {
    spotifyApi.setClientId(clientId);
}
function setClientSecret(clientSecret) {
    spotifyApi.setClientSecret(clientSecret);
}
function setRefreshToken(refreshToken) {
    spotifyApi.setRefreshToken(refreshToken);
}
function fetchNewRefreshToken(clientId, clientSecret) {
    const app = express();

    const server = app.listen(PORT, async () => {
        // Construct Authorization URL
        const authUrl = 'https://accounts.spotify.com/authorize?' + querystring.stringify({
            response_type: 'code',
            client_id: clientId,
            scope: SCOPE,
            redirect_uri: REDIRECT_URI,
        });

        console.log(`Server running on port ${PORT}`);
        console.log('Opening browser for authentication...');
        await open(authUrl);
    });

    app.get('/callback', async (req, res) => {
        const code = req.query.code || null;

        if (!code) {
            res.send('Authorization failed: No code received.');
            return;
        }

        try {
            // Exchange Code for Token
            const tokenResponse = await axios({
                method: 'post',
                url: 'https://accounts.spotify.com/api/token',
                data: querystring.stringify({
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    grant_type: 'authorization_code'
                }),
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64'))
                }
            });

            const accessToken = tokenResponse.data.access_token;
            console.log('\n--- SUCCESS ---');
            console.log('Access Token acquired!');

            setRefreshToken(accessToken);
            res.send('Authorization successful! You can close this window.');
            server.close(); // Stop the server after successful auth

            
        } catch (error) {
            console.error('Error getting token:', error.response ? error.response.data : error.message);
            res.send('Error getting token.');

        }
    });
}


module.exports = { getSpotifyApiInstance, setClientID, setClientSecret, setRefreshToken, fetchNewRefreshToken };