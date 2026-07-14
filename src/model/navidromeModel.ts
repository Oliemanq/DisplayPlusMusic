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

export type NavidromePlaybackClient = {
    clientName: string;
    title: string;
    artist: string;
    songID: string;
    isPlaying: boolean;
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

function normalizeClientName(entry: NavidromeNowPlayingEntry): string {
    return entry.playerName?.trim() || entry.username?.trim() || 'Unknown client';
}

function toClientSummary(entry: NavidromeNowPlayingEntry): NavidromePlaybackClient {
    const playbackState = entry.state ?? 'playing';
    return {
        clientName: normalizeClientName(entry),
        title: entry.title ?? 'Unknown Title',
        artist: entry.artist ?? 'Unknown Artist',
        songID: entry.id ?? entry.coverArt ?? '0',
        isPlaying: playbackState !== 'paused' && playbackState !== 'stopped',
    };
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
    private selectedClientName = '';
    private playbackClients: NavidromePlaybackClient[] = [];

    async init(): Promise<boolean> {
        this.baseUrl = normalizeBaseUrl((await storage.getItem('navidrome_base_url')) ?? '');
        this.username = (await storage.getItem('navidrome_username')) ?? '';
        this.password = (await storage.getItem('navidrome_password')) ?? '';
        this.selectedClientName = (await storage.getItem('navidrome_selected_client')) ?? '';

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

    private async getNowPlayingData(): Promise<NavidromeNowPlayingEntry[]> {
        if (!this.baseUrl || !this.username || !this.password) {
            return [];
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

        const entries = subsonic.nowPlaying?.entry;
        if (!entries) {
            return [];
        }

        return Array.isArray(entries) ? entries : [entries];
    }

    getPlaybackClients(): NavidromePlaybackClient[] {
        return this.playbackClients;
    }

    getSelectedPlaybackClient(): string {
        return this.selectedClientName;
    }

    async setSelectedPlaybackClient(clientName: string): Promise<void> {
        this.selectedClientName = clientName;
        await storage.setItem('navidrome_selected_client', clientName);
    }

    async fetchCurrentTrack(): Promise<Song> {
        try {
            const entries = await this.getNowPlayingData();
            this.playbackClients = entries.map(toClientSummary);

            if (entries.length === 0) {
                if (this.currentSong.songID !== '0') {
                    this.currentSong.addisPlaying(false);
                    return this.currentSong;
                }
                return song_placeholder;
            }

            const selectedEntry = entries.find(entry => normalizeClientName(entry) === this.selectedClientName)
                ?? entries[0];

            const selectedClientName = normalizeClientName(selectedEntry);
            if (selectedClientName !== this.selectedClientName) {
                this.selectedClientName = selectedClientName;
                await storage.setItem('navidrome_selected_client', selectedClientName);
            }

            const song = new Song();
            song.addID(selectedEntry.id ?? selectedEntry.coverArt ?? '0');
            song.addTitle(selectedEntry.title ?? 'Unknown Title');
            song.addArtist(selectedEntry.artist ?? 'Unknown Artist');
            song.addFeatures([]);
            song.addAlbum(selectedEntry.album ?? 'Unknown Album');
            song.addDurationSeconds(selectedEntry.duration ?? 0);
            const now = performance.now();
            const playbackState = selectedEntry.state ?? 'playing';
            const isPlaying = playbackState !== 'paused' && playbackState !== 'stopped';
            const sameTrack = song.songID === this.lastSnapshotSongID && this.lastSnapshotSongID !== '0';
            const serverProgress = (selectedEntry.positionMs ?? 0) / 1000;
            let progressSeconds = serverProgress;

            if (sameTrack && this.lastSnapshotAt > 0) {
                const elapsedSeconds = Math.max(0, (now - this.lastSnapshotAt) / 1000);
                const localProgress = this.lastSnapshotProgressSeconds + (this.lastSnapshotIsPlaying ? elapsedSeconds : 0);
                const drift = Math.abs(serverProgress - localProgress);
                if (drift > 1.5) {
                    console.log(`[Navidrome] Drift corrected: ${drift.toFixed(2)}s (local: ${localProgress.toFixed(2)}s, server: ${serverProgress.toFixed(2)}s)`);
                    progressSeconds = serverProgress;
                } else {
                    progressSeconds = localProgress;
                }
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

            if (selectedEntry.coverArt || selectedEntry.albumId || selectedEntry.id) {
                this.fetchArtAsync(selectedEntry.coverArt ?? selectedEntry.albumId ?? selectedEntry.id ?? '', this.currentSong).catch(console.error);
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
                downloadImageAsGrayscalePng(url, 144, 144),
                downloadImage(url, 120, 120),
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