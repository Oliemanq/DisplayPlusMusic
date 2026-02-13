import spotifyModel from '../model/spotifyModel';
import Song from '../model/songModel';
import { formatTime } from '../Scripts/formatTime';
import { createView } from '../view/GlassesView';

class SpotifyPresenter {
    constructor() {
        // Optional: Stop polling when the tab is hidden to save resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPolling();
            } else {
                this.startPolling();
            }
        });
    }

    private isPolling = false;
    private pollingRate = 1000; //Polling rate in ms
    private pollingTimeout: number | undefined;
    private currentSong?: Song

    async startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.poll();
    }

    stopPolling() {
        this.isPolling = false;
        if (this.pollingTimeout) {
            clearTimeout(this.pollingTimeout);
            this.pollingTimeout = undefined;
        }
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            this.currentSong = await this.fetchCurrentSong();
            createView(this.currentSong);
        } catch (error) {
            console.error("Error fetching song:", error);
        }

        // Schedule next poll only after the current one completes
        if (this.isPolling) {
            this.pollingTimeout = window.setTimeout(() => this.poll(), this.pollingRate);
        }
    }

    async fetchCurrentSong(): Promise<Song> {
        let temp = await spotifyModel.fetchCurrentTrack();
        this.updateHTML(temp)
        return temp
    }

    async updateHTML(song: Song) {
        document.getElementById('track-name')!.textContent = song.title;
        document.getElementById('artist-name')!.textContent = song.artist;
        document.getElementById('album-name')!.textContent = song.album;
        document.getElementById('track-progress')!.textContent = formatTime(song.progressSeconds);
        document.getElementById('track-duration')!.textContent = formatTime(song.durationSeconds);
        document.getElementById('paused-state')!.textContent = song.isPlaying ? "Playing" : "Paused";

        const imgElement = document.getElementById('album-art') as HTMLImageElement;
        if (imgElement && song.albumArtRaw.length > 0) {
            const blob = new Blob([song.albumArtRaw] as BlobPart[], { type: 'image/png' });
            imgElement.src = URL.createObjectURL(blob);
        }
    }

    song_pauseplay() {
        spotifyModel.song_Pause();
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
