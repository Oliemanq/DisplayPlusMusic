import spotifyModel from '../model/spotifyModel';
import Song from '../model/songModel';

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
    private pollingRate = 250; //Polling rate in ms
    private pollingTimeout: number | undefined;

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
            await this.fetchCurrentSong();
        } catch (error) {
            console.error("Error fetching song:", error);
        }

        // Schedule next poll only after the current one completes
        if (this.isPolling) {
            this.pollingTimeout = window.setTimeout(() => this.poll(), this.pollingRate);
        }
    }

    async fetchCurrentSong() {
        let temp = await spotifyModel.fetchCurrentTrack();
        this.updateHTML(temp)
        return temp
    }
    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async updateHTML(song: Song) {
        document.getElementById('track-name')!.textContent = song.title;
        document.getElementById('artist-name')!.textContent = song.artist;
        document.getElementById('album-name')!.textContent = song.album;
        document.getElementById('track-progress')!.textContent = this.formatTime(song.progressSeconds);
        document.getElementById('track-duration')!.textContent = this.formatTime(song.durationSeconds);
        document.getElementById('paused-state')!.textContent = song.isPlaying ? "Playing" : "Paused";

        const imgElement = document.getElementById('album-art') as HTMLImageElement;
        if (imgElement) {
            imgElement.src = URL.createObjectURL(song.albumArt);
            imgElement.style.filter = 'grayscale(100%) sepia(100%) hue-rotate(90deg) saturate(5)';
        }
    }
}

const spotifyPresenter = new SpotifyPresenter();

export default spotifyPresenter;
