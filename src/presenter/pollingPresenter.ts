import spotifyPresenter from './spotifyPresenter';
import lyricsPresenter from './lyricsPresenter';
import { createView } from '../view/GlassesView';
import viewPresenter from './viewPresenter';

class PollingPresenter {
    private readonly API_INTERVAL_MS = 1000; // 1000ms = 1 sec
    private readonly QUICK_INTERVAL_MS = 10;

    private isPolling = false;
    private apiTimeout: number | undefined;
    private quickTimeout: number | undefined;
    private lastFrameTime = performance.now();

    startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.lastFrameTime = performance.now();
        this.pollAPIs();
        this.pollQuick();
    }

    stopPolling() {
        this.isPolling = false;
        clearTimeout(this.apiTimeout);
        clearTimeout(this.quickTimeout);
        this.apiTimeout = undefined;
        this.quickTimeout = undefined;
    }

    private async pollAPIs() {
        if (!this.isPolling) return;
        try {
            await spotifyPresenter.pollSingle();
            const song = spotifyPresenter.currentSong;
            if (song) {
                await lyricsPresenter.updateLyrics(song);
                viewPresenter.updateHTML(song);
            }
            if (spotifyPresenter.nextSong) {
                lyricsPresenter.cacheNextLyrics(spotifyPresenter.nextSong);
            }
        } catch (e) {
            console.error('[pollAPIs] Error:', e);
        }
        if (this.isPolling) {
            this.apiTimeout = window.setTimeout(() => this.pollAPIs(), this.API_INTERVAL_MS);
        }
    }

    private pollQuick() {
        if (!this.isPolling) return;

        const now = performance.now();
        const delta = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const song = spotifyPresenter.currentSong;
        if (song) {
            if (song.isPlaying && song.progressSeconds < song.durationSeconds) {
                song.progressSeconds += delta;
            }
            // Both fire-and-forget — neither should block the clock
            lyricsPresenter.updateLyricsLine().catch(e => console.error('[pollQuick] Lyrics error:', e));
            createView(song);
        }

        if (this.isPolling) {
            this.quickTimeout = window.setTimeout(() => this.pollQuick(), this.QUICK_INTERVAL_MS);
        }
    }
}

const pollingPresenter = new PollingPresenter();
export default pollingPresenter;
