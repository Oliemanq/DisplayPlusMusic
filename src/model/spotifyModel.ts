import { SpotifyApi, Track, Episode } from '@spotify/web-api-ts-sdk';
import Song, { song_placeholder } from '../model/songModel';
import { setPlaceholderLoginHint } from '../model/songModel';
import { downloadImageAsGrayscalePng, downloadImage } from './imageModel';
import { storage } from '../utils/storage';
import spotifyAuthModel from './spotifyAuthModel';

let spotifysdk!: SpotifyApi;

export async function initSpotify(): Promise<void> {
    const clientId = await storage.getItem('spotify_client_id');
    const clientSecret = await storage.getItem('spotify_client_secret');
    const codeData = await spotifyAuthModel.checkForAuthCode();

    let refreshToken: string | null = null;
    try {
        const stored = await storage.getItem('spotify_refresh_token');
        if (stored && stored.length > 20) refreshToken = stored;
    } catch (e) {
        console.error('Error reading refresh token:', e);
    }

    if (!clientId || !clientSecret) {
        console.error('Spotify credentials not set');
        setPlaceholderLoginHint(true);
        return;
    }

    document.getElementById('spotify-auth-popup')!.style.display = 'none';

    const exchangeRefreshToken = async (token: string) => {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
            },
            body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token }),
        });
        const data = await response.json();
        if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data));
        return data;
    };

    try {
        let authData: any;

        if (codeData) {
            authData = codeData;
            if (authData.refresh_token) {
                refreshToken = authData.refresh_token;
                await storage.setItem('spotify_refresh_token', refreshToken!).catch(console.error);
                console.log('Initial refresh token saved.');
            }
        } else if (refreshToken) {
            authData = await exchangeRefreshToken(refreshToken);
        } else {
            console.error('No auth data available');
            setPlaceholderLoginHint(true);
            document.getElementById('spotify-auth-popup')!.style.display = 'flex';
            return;
        }

        setPlaceholderLoginHint(false);

        // Persist rotated refresh token if Spotify issued a new one
        if (authData.refresh_token && authData.refresh_token !== refreshToken) {
            refreshToken = authData.refresh_token;
            await storage.setItem('spotify_refresh_token', refreshToken!).catch(console.error);
        }

        spotifysdk = SpotifyApi.withAccessToken(clientId, {
            access_token: authData.access_token,
            token_type: authData.token_type ?? 'Bearer',
            expires_in: authData.expires_in,
            refresh_token: refreshToken ?? '',
            expires: Date.now() + authData.expires_in * 1000,
        });

        console.log('Spotify SDK initialized.');
    } catch (e) {
        console.error('Spotify auth error:', e);
        setPlaceholderLoginHint(true);
        document.getElementById('spotify-auth-popup')!.style.display = 'flex';
    }
}

class SpotifyModel {
    private lastSong = new Song();
    currentSong = new Song();
    deviceId = '';

    async fetchCurrentTrack(): Promise<Song> {
        let result;
        try {
            result = await spotifysdk.player.getPlaybackState();
        } catch {
            return song_placeholder;
        }

        if (!result?.device?.id) {
            // Nothing playing — return last known song paused, or placeholder
            if (this.lastSong.songID !== '0') {
                this.lastSong.addisPlaying(false);
                return this.lastSong;
            }
            return song_placeholder;
        }

        if (this.deviceId !== result.device.id) {
            console.log(`Device ID: ${this.deviceId} → ${result.device.id}`);
            this.deviceId = result.device.id;
        }

        if (!result.item) return song_placeholder;

        if (result.item.type === 'track') {
            const track = result.item as Track;

            if (track.id !== this.lastSong.songID) {
                // New song — build it and return immediately; fetch art in background
                const song = new Song();
                song.addID(track.id);
                song.addTitle(track.name);
                song.addArtist(track.artists[0].name);
                song.addFeatures(track.artists.slice(1).map(a => a.name));
                song.addAlbum(track.album.name);
                song.addDurationSeconds(track.duration_ms / 1000);
                song.addProgressSeconds(result.progress_ms / 1000);
                song.addisPlaying(result.is_playing);
                song.addChangedState(true);

                console.log(`Now playing: ${song.title} by ${song.artist}`);

                this.lastSong = song;
                this.currentSong = song;

                // Art fetch doesn't block — patches song object when ready
                this.fetchArtAsync(track, song);

                return song;
            }

            // Same song — update dynamic fields only
            if (this.lastSong.isPlaying !== result.is_playing) {
                console.log(result.is_playing
                    ? `Resumed: ${this.lastSong.title}`
                    : `Paused: ${this.lastSong.title}`
                );
            }
            this.lastSong.addisPlaying(result.is_playing);

            const serverProgress = result.progress_ms / 1000;
            const drift = Math.abs(serverProgress - this.lastSong.progressSeconds);
            if (drift > 0.5) {
                console.log(`[Spotify] Drift corrected: ${drift.toFixed(2)}s`);
                this.lastSong.addProgressSeconds(serverProgress);
            }

            this.lastSong.addChangedState(false);
            this.currentSong = this.lastSong;
            return this.lastSong;

        } else if (result.item.type === 'episode') {
            const episode = result.item as Episode;
            const song = new Song();
            song.type = 'Episode';
            song.addTitle(episode.name);
            song.addID(episode.id);
            console.log(`Now playing episode: ${episode.name}`);
            this.currentSong = song;
            return song;
        }

        return song_placeholder;
    }

    async fetchNextTrack(): Promise<Song | undefined> {
        try {
            const queue = await spotifysdk.player.getUsersQueue();
            const next = queue?.queue?.[0];
            if (next?.type === 'track') {
                const track = next as Track;
                const song = new Song();
                song.addID(track.id);
                song.addTitle(track.name);
                song.addArtist(track.artists[0].name);
                song.addFeatures(track.artists.slice(1).map(a => a.name));
                song.addAlbum(track.album.name);
                return song;
            }
        } catch {
            // Queue unavailable — not critical
        }
        return undefined;
    }

    private async fetchArtAsync(track: Track, song: Song): Promise<void> {
        try {
            const url = track.album.images[0].url;
            const [raw, color] = await Promise.all([
                downloadImageAsGrayscalePng(url, 144, 144),
                downloadImage(url, 120, 120),
            ]);
            // Only patch if this song is still current
            if (this.currentSong === song) {
                song.addArtRaw(raw);
                song.addArtColor(color);
                console.log(`[Spotify] Art ready for: ${song.title}`);
            }
        } catch (e) {
            console.error('[Spotify] Art fetch failed:', e);
        }
    }

    async song_Pause() {
        try {
            this.currentSong?.addisPlaying(false);
            await spotifysdk.player.pausePlayback(this.deviceId);
        } catch (e) { console.error('Pause failed:', e); }
    }

    async song_Play() {
        try {
            this.currentSong?.addisPlaying(true);
            await spotifysdk.player.startResumePlayback(this.deviceId);
        } catch (e) { console.error('Play failed:', e); }
    }

    async song_Back() {
        try {
            await spotifysdk.player.skipToPrevious(this.deviceId);
        } catch (e) { console.error('Back failed:', e); }
    }

    async song_Forward() {
        try {
            await spotifysdk.player.skipToNext(this.deviceId);
        } catch (e) { console.error('Forward failed:', e); }
    }
}

const spotifyModel = new SpotifyModel();
export default spotifyModel;