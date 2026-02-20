import spotifyModel, { initSpotify } from '../model/spotifyModel';
import Song from '../model/songModel';
import { formatTime } from '../Scripts/formatTime';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import pollingPresenter from './pollingPresenter';

class SpotifyPresenter {
    public currentSong?: Song;
    public nextSong?: Song;

    constructor() {
        // Optional: Stop polling when the tab is hidden to save resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                pollingPresenter.stopPolling();
            } else {
                pollingPresenter.startPolling();
            }
        });
    }

    // Polling logic moved to pollingPresenter.ts

    async pollSingle() {
        try {
            this.currentSong = await this.fetchCurrentSong();
            this.nextSong = await spotifyModel.fetchNextTrack();
        } catch (error) {
            console.error("Error fetching song:", error);
        }
    }

    async fetchCurrentSong(): Promise<Song> {
        let temp = await spotifyModel.fetchCurrentTrack();
        this.updateHTML(temp)
        return temp
    }

    async updateHTML(song: Song) {
        document.getElementById('song-name')!.textContent = song.title;
        document.getElementById('song-artist')!.textContent = song.artist;
        document.getElementById('song-album')!.textContent = song.album;
        document.getElementById('song-current-time')!.textContent = formatTime(song.progressSeconds);
        document.getElementById('song-total-time')!.textContent = formatTime(song.durationSeconds);

        const imgElement = document.getElementById('album-art') as HTMLImageElement;
        if (imgElement && song.albumArtRaw.length > 0) {
            const blob = new Blob([song.albumArtRaw] as BlobPart[], { type: 'image/png' });
            imgElement.src = URL.createObjectURL(blob);
        }
    }

    async startAuth(tokenIn: string) {
        const bridge = await waitForEvenAppBridge();

        bridge.setLocalStorage('spotify_refresh_token', tokenIn);

        initSpotify();
    }

    song_pauseplay() {
        if (this.currentSong!.isPlaying) {
            spotifyModel.song_Pause();
        } else {
            spotifyModel.song_Play();
        }
    }
    song_back() {
        spotifyModel.song_Back();
    }
    song_forward() {
        spotifyModel.song_Forward();
    }
}

const spotifyPresenter = new SpotifyPresenter();

export default spotifyPresenter;
