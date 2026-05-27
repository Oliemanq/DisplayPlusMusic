import Song, { song_placeholder } from './songModel';
import { downloadImageAsGrayscalePng, downloadImage } from './imageModel';
import { storage } from '../utils/storage';

type NavidromeNowPlayingEntry = {
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    albumId?: string;
    artistId?: string;
    albumArtistId?: string;
    coverArt?: string;
    duration?: number;
    positionMs?: number;
    playbackRate?: number;
    state?: string;
    username?: string;
    playerName?: string;
};

type SubsonicResponse = {
    'subsonic-response'?: {
        status?: string;
        error?: { message?: string };
        nowPlaying?: {
            entry?: NavidromeNowPlayingEntry | NavidromeNowPlayingEntry[];
        };
    };
};

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

function pickFirstEntry(entry?: NavidromeNowPlayingEntry | NavidromeNowPlayingEntry[]) {
    if (!entry) return undefined;
    return Array.isArray(entry) ? entry[0] : entry;
}

class NavidromeModel {
    private baseUrl = '';
    private username = '';
    private password = '';
    currentSong = new Song();
    private lastSnapshotAt = 0;
    private lastSnapshotSongID = '0';
    private lastSnapshotProgressSeconds = 0;
    private lastSnapshotIsPlaying = false;

    async init(): Promise<boolean> {
        this.baseUrl = normalizeBaseUrl((await storage.getItem('navidrome_base_url')) ?? '');
        this.username = (await storage.getItem('navidrome_username')) ?? '';
        this.password = (await storage.getItem('navidrome_password')) ?? '';

        const isConfigured = Boolean(this.baseUrl && this.username && this.password);
        const popup = document.getElementById('spotify-auth-popup');
        if (popup) {
            popup.style.display = isConfigured ? 'none' : 'flex';
        }

        return isConfigured;
    }

    private async authQueryParams(): Promise<URLSearchParams> {
        return new URLSearchParams({
            u: this.username,
            p: this.password,
            v: '1.16.1',
            c: 'evenhub',
            f: 'json',
        });
    }

    private async getNowPlayingData(): Promise<NavidromeNowPlayingEntry | undefined> {
        if (!this.baseUrl || !this.username || !this.password) {
            return undefined;
        }

        const params = await this.authQueryParams();
        const response = await fetch(`${this.baseUrl}/rest/getNowPlaying.view?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Navidrome now playing request failed: ${response.status}`);
        }

        const data = (await response.json()) as SubsonicResponse;
        const subsonic = data['subsonic-response'];
        if (!subsonic || subsonic.status !== 'ok') {
            throw new Error(subsonic?.error?.message || 'Failed to fetch Navidrome now playing data');
        }

        return pickFirstEntry(subsonic.nowPlaying?.entry);
    }

    async fetchCurrentTrack(): Promise<Song> {
        try {
            const entry = await this.getNowPlayingData();
            if (!entry) {
                if (this.currentSong.songID !== '0') {
                    this.currentSong.addisPlaying(false);
                    return this.currentSong;
                }
                return song_placeholder;
            }

            const song = new Song();
            song.addID(entry.id ?? entry.coverArt ?? '0');
            song.addTitle(entry.title ?? 'Unknown Title');
            song.addArtist(entry.artist ?? 'Unknown Artist');
            song.addFeatures([]);
            song.addAlbum(entry.album ?? 'Unknown Album');
            song.addDurationSeconds(entry.duration ?? 0);
            const now = performance.now();
            const isPlaying = (entry.state ?? 'playing') !== 'paused' && (entry.state ?? 'stopped') !== 'stopped';
            const sameTrack = song.songID === this.lastSnapshotSongID && this.lastSnapshotSongID !== '0';
            let progressSeconds = (entry.positionMs ?? 0) / 1000;

            if (sameTrack && this.lastSnapshotAt > 0) {
                const elapsedSeconds = Math.max(0, (now - this.lastSnapshotAt) / 1000);
                progressSeconds = this.lastSnapshotProgressSeconds + (this.lastSnapshotIsPlaying ? elapsedSeconds : 0);
            }

            if (song.durationSeconds > 0) {
                progressSeconds = Math.min(progressSeconds, song.durationSeconds);
            }

            song.addProgressSeconds(progressSeconds);
            song.addisPlaying(isPlaying);
            song.addChangedState(song.songID !== this.currentSong.songID);

            if (!sameTrack) {
                this.currentSong = song;
            } else {
                this.currentSong.addTitle(song.title);
                this.currentSong.addArtist(song.artist);
                this.currentSong.addFeatures(song.features);
                this.currentSong.addAlbum(song.album);
                this.currentSong.addDurationSeconds(song.durationSeconds);
                this.currentSong.addProgressSeconds(progressSeconds);
                this.currentSong.addisPlaying(isPlaying);
                this.currentSong.addChangedState(false);
            }

            this.lastSnapshotAt = now;
            this.lastSnapshotSongID = song.songID;
            this.lastSnapshotProgressSeconds = progressSeconds;
            this.lastSnapshotIsPlaying = isPlaying;

            if (entry.coverArt || entry.albumId || entry.id) {
                this.fetchArtAsync(entry.coverArt ?? entry.albumId ?? entry.id ?? '', this.currentSong).catch(console.error);
            }

            return this.currentSong;
        } catch (error) {
            console.error('[Navidrome] fetchCurrentTrack failed:', error);
            return song_placeholder;
        }
    }

    async fetchNextTrack(): Promise<Song | undefined> {
        return undefined;
    }

    async song_Pause() {
        console.log('[Navidrome] Pause is not supported from the Even Hub app.');
    }

    async song_Play() {
        console.log('[Navidrome] Play is not supported from the Even Hub app.');
    }

    async song_Back() {
        console.log('[Navidrome] Previous track is not supported from the Even Hub app.');
    }

    async song_Forward() {
        console.log('[Navidrome] Next track is not supported from the Even Hub app.');
    }

    private async fetchArtAsync(coverArtId: string, song: Song): Promise<void> {
        try {
            if (!coverArtId) {
                return;
            }

            const url = `${this.baseUrl}/rest/getCoverArt.view?${new URLSearchParams({
                id: coverArtId,
                u: this.username,
                p: this.password,
                v: '1.16.1',
                c: 'evenhub',
            }).toString()}`;

            const [raw, color] = await Promise.all([
                downloadImageAsGrayscalePng(url, 100, 100),
                downloadImage(url, 132, 132),
            ]);

            if (this.currentSong === song) {
                song.addArtRaw(raw);
                song.addArtColor(color);
                console.log(`[Navidrome] Art ready for: ${song.title}`);
            }
        } catch (error) {
            console.error('[Navidrome] Art fetch failed:', error);
        }
    }
}

const navidromeModel = new NavidromeModel();
export default navidromeModel;