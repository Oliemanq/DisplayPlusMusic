import spotifyPresenter from "./spotifyPresenter";
import lyricsPresenter from "./lyricsPresenter";
import { createView } from "../view/GlassesView";

class PollingPresenter {
    pollingtimeAPIs: number = 500;
    pollingtimeLyrics: number = 100;
    private isPolling = false;
    private apiTimeout: number | undefined;
    private lyricsTimeout: number | undefined;

    async startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.pollAPIs();
        this.pollLyrics();
    }

    stopPolling() {
        this.isPolling = false;
        if (this.apiTimeout) clearTimeout(this.apiTimeout);
        if (this.lyricsTimeout) clearTimeout(this.lyricsTimeout);
        this.apiTimeout = undefined;
        this.lyricsTimeout = undefined;
    }

    private async pollAPIs() {
        if (!this.isPolling) return;

        try {
            await spotifyPresenter.pollSingle();
            if (spotifyPresenter.currentSong) {
                await lyricsPresenter.updateLyrics(spotifyPresenter.currentSong);
            }
            if (spotifyPresenter.nextSong) {
                await lyricsPresenter.cacheNextLyrics(spotifyPresenter.nextSong);
            }
        } catch (error) {
            console.error("Error polling APIs:", error);
        }

        if (this.isPolling) {
            this.apiTimeout = window.setTimeout(() => this.pollAPIs(), this.pollingtimeAPIs);
        }
    }

    private async pollLyrics() {
        if (!this.isPolling) return;

        try {
            if (spotifyPresenter.currentSong) {
                // Approximate fast progress updates between actual API fetches
                if (spotifyPresenter.currentSong.isPlaying) {
                    spotifyPresenter.currentSong.progressSeconds += (this.pollingtimeLyrics / 1000);
                }

                await lyricsPresenter.updateLyricsLine();
                createView(spotifyPresenter.currentSong);
            }
        } catch (error) {
            console.error("Error polling lyrics:", error);
        }

        if (this.isPolling) {
            this.lyricsTimeout = window.setTimeout(() => this.pollLyrics(), this.pollingtimeLyrics);
        }
    }
}

const pollingPresenter = new PollingPresenter();
export default pollingPresenter;