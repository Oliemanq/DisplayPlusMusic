import spotifyPresenter from './spotifyPresenter';
import { storage } from '../utils/storage';
import spotifyAuthModel from '../model/spotifyAuthModel';

class ViewPresenter {
    constructor() { }

    forwardTrack() {
        spotifyPresenter.song_forward();
    }
    playPauseTrack() {
        spotifyPresenter.song_pauseplay();
    }
    backTrack() {
        spotifyPresenter.song_back();
    }

    loginPage() {
        spotifyAuthModel.generateRefreshToken();
    }

    async copyLoginLink() {
        const linkElem = document.getElementById('login-page-link');
        const linkText = linkElem ? linkElem.textContent : "";
        if (!linkText) {
            alert("No link to copy. Please click 'Open login page' first.");
            return;
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(linkText);
                alert("Link copied to clipboard!");
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = linkText;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert("Link copied to clipboard!");
            }
        } catch (err) {
            console.error("Failed to copy text: ", err);
            alert("Failed to copy link.");
        }
    }

    async saveRefreshToken() {
        const inputVal = (document.getElementById('refresh-token') as HTMLInputElement).value;
        console.log("Attempting to save/exchange token...");

        const newToken = await spotifyAuthModel.exchangeCodeForToken(inputVal);
        if (newToken) {
            console.log("Exchanged code for refresh token successfully.");
            await storage.setItem('spotify_refresh_token', newToken);
            alert("Token exchanged and saved! Reloading...");
            window.location.reload();
        } else {
            alert("Token exchange failed, possible incorrect or invalid code");
        }
    }

    async clearLocalStorage() {
        console.log("Started clear")
        await storage.removeItem('spotify_refresh_token');
        console.log("Removed refresh token")
        await storage.removeItem('spotify_access_token');
        console.log("Removed access token")
        await storage.removeItem('spotify_code_verifier');
        console.log("Removed code verifier")
        console.log("Spotify session cleared!");
        window.location.reload();
    }
}

const viewPresenter = new ViewPresenter();
export default viewPresenter;