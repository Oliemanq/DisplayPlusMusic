const keys = require('./Spotify_API_Keys');
const { getNowPlaying } = require('./Spotfiy_API_Usage');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});



async function updateKeys() {
    rl.question('Enter your Client ID: ', (clientId) => {
        rl.question('Enter your Client Secret: ', (clientSecret) => {
            
            // Trim whitespace just in case of copy-paste errors
            const cleanId = clientId.trim();
            const cleanSecret = clientSecret.trim();
    
            console.log('\nCredentials received. Starting server...');
            rl.close(); // Stop listening for input
    
            // 3. Start the main logic with the provided credentials
            keys.setClientID(cleanId);
            keys.setClientSecret(cleanSecret);

            keys.fetchNewRefreshToken(cleanId, cleanSecret);

            getNowPlaying();

        });
    });
}

module.exports = { updateKeys };