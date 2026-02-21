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

    async saveAndAuthorize() {
        const clientId = (document.getElementById('client-id') as HTMLInputElement).value.trim();
        const clientSecret = (document.getElementById('client-secret') as HTMLInputElement).value.trim();

        if (!clientId || !clientSecret) {
            alert("Please provide both Client ID and Client Secret.");
            return;
        }

        await storage.setItem('spotify_client_id', clientId);
        await storage.setItem('spotify_client_secret', clientSecret);

        spotifyAuthModel.generateAuthUrl(clientId);
    }

    async clearLocalStorage() {
        console.log("Started clear")
        await storage.removeItem('spotify_refresh_token');
        await storage.removeItem('spotify_access_token');
        await storage.removeItem('spotify_client_id');
        await storage.removeItem('spotify_client_secret');
        await storage.removeItem('spotify_auth_state');
        console.log("Spotify session cleared!");
        window.location.reload();
    }
}

const viewPresenter = new ViewPresenter();
export default viewPresenter;