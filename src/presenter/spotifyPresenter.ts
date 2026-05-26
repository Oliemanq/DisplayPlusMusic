import spotifyModel, { initSpotify } from '../model/spotifyModel';
import Song, { song_placeholder } from '../model/songModel';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

class SpotifyPresenter {
    currentSong: Song = song_placeholder;
    nextSong?: Song;

    async pollSingle() {
        try {
            this.currentSong = await spotifyModel.fetchCurrentTrack();
            this.nextSong = await spotifyModel.fetchNextTrack();
        } catch (e) {
            console.error('[SpotifyPresenter] pollSingle error:', e);
        }
    }

    async fetchCurrentSong(): Promise<Song> {
        return spotifyModel.fetchCurrentTrack();
    }

    async startAuth(token: string) {
        const bridge = await waitForEvenAppBridge();
        bridge.setLocalStorage('spotify_refresh_token', token);
        initSpotify();
    }

    song_pauseplay() {
        this.currentSong?.isPlaying ? spotifyModel.song_Pause() : spotifyModel.song_Play();
    }
    song_back() { spotifyModel.song_Back(); }
    song_forward() { spotifyModel.song_Forward(); }
}

const spotifyPresenter = new SpotifyPresenter();
export default spotifyPresenter;