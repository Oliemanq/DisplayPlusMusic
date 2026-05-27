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

    song_pauseplay() {
        if (this.activeSource === 'navidrome') {
            navidromeModel.song_Pause();
            return;
        }

        this.currentSong?.isPlaying ? spotifyModel.song_Pause() : spotifyModel.song_Play();
    }
    song_back() {
        if (this.activeSource === 'navidrome') {
            navidromeModel.song_Back();
            return;
        }
        spotifyModel.song_Back();
    }
    song_forward() {
        if (this.activeSource === 'navidrome') {
            navidromeModel.song_Forward();
            return;
        }
        spotifyModel.song_Forward();
    }
}

const spotifyPresenter = new SpotifyPresenter();
export default spotifyPresenter;