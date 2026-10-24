import spotifyModel, { initSpotify } from '../model/spotifyModel';
import navidromeModel from '../model/navidromeModel';
import Song, { song_placeholder } from '../model/songModel';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { storage } from '../utils/storage';
import type { MusicSource } from '../model/musicSource';

class SpotifyPresenter {
    currentSong: Song = song_placeholder;
    nextSong?: Song;
    private activeSource: MusicSource = 'spotify';
    private controlQueue: Promise<void> = Promise.resolve();
    isMiniMode = false;
    onModeChanged?: () => void;

    async pollSingle() {
        try {
            if (this.activeSource === 'navidrome') {
                this.currentSong = await navidromeModel.fetchCurrentTrack();
                this.nextSong = await navidromeModel.fetchNextTrack();
                return;
            }

            this.currentSong = await spotifyModel.fetchCurrentTrack();
            this.nextSong = await spotifyModel.fetchNextTrack();
        } catch (e) {
            console.error('[SpotifyPresenter] pollSingle error:', e);
        }
    }

    toggleMiniMode() {
        this.isMiniMode = !this.isMiniMode;
        if (this.onModeChanged) this.onModeChanged();
    }

    async fetchCurrentSong(): Promise<Song> {
        return this.activeSource === 'navidrome'
            ? navidromeModel.fetchCurrentTrack()
            : spotifyModel.fetchCurrentTrack();
    }

    getActiveSource(): MusicSource {
        return this.activeSource;
    }

    async initActiveSource(): Promise<void> {
        const storedSource = (await storage.getItem('music_source')) as MusicSource | null;
        this.activeSource = storedSource ?? 'spotify';

        if (this.activeSource === 'navidrome') {
            const configured = await navidromeModel.init();
            if (!configured) {
                return;
            }
            return;
        }

        await initSpotify();
    }

    async startAuth(token: string) {
        const bridge = await waitForEvenAppBridge();
        bridge.setLocalStorage('spotify_refresh_token', token);
        initSpotify();
    }

    private queueControl(action: () => Promise<void>): void {
        this.controlQueue = this.controlQueue
            .then(action)
            .catch(error => console.error('[SpotifyPresenter] playback control error:', error));
    }

    song_pauseplay(): void {
        this.queueControl(async () => {
            if (this.activeSource === 'navidrome') {
                await navidromeModel.song_Pause();
                return;
            }

            if (this.currentSong?.isPlaying) {
                await spotifyModel.song_Pause();
            } else {
                await spotifyModel.song_Play();
            }
        });
    }

    song_back(): void {
        this.queueControl(() => this.activeSource === 'navidrome'
            ? navidromeModel.song_Back()
            : spotifyModel.song_Back());
    }

    song_forward(): void {
        this.queueControl(() => this.activeSource === 'navidrome'
            ? navidromeModel.song_Forward()
            : spotifyModel.song_Forward());
    }

    async setNavidromeClient(clientName: string) {
        if (this.activeSource !== 'navidrome') {
            return;
        }

        await navidromeModel.setSelectedPlaybackClient(clientName);
        this.currentSong = await navidromeModel.fetchCurrentTrack();
    }
}

const spotifyPresenter = new SpotifyPresenter();
export default spotifyPresenter;