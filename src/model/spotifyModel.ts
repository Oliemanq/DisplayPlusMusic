import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import Song, { song_placeholder } from '../model/songModel';
import { downloadImageAsGrayscalePng } from "./imageModel";
import { storage } from '../utils/storage';
import spotifyAuthModel from './spotifyAuthModel';
import placeholderArt from '../Assets/placeholder_art.jpg';
import { fetchLyrics } from "./lyricsModel";

let spotifysdk!: SpotifyApi;

async function initSpotify(): Promise<void> {
    const clientId = await storage.getItem('spotify_client_id');
    const clientSecret = await storage.getItem('spotify_client_secret');

    // Check if we are returning from an auth redirect
    const codeData = await spotifyAuthModel.checkForAuthCode();

    let refreshTokenToUse;
    let authData;

    try {
        const storedToken = await storage.getItem("spotify_refresh_token");
        if (storedToken && storedToken.length > 20) {
            refreshTokenToUse = storedToken;
        }
    } catch (e) {
        console.error("Error accessing storage:", e);
    }

    if (!clientId || !clientSecret || (!refreshTokenToUse && !codeData)) {
        console.error("Setup incomplete!");
        const popup = document.getElementById('spotify-auth-popup');
        if (popup) {
            popup.style.display = 'flex';
        }
        return;
    }

    // Assign dynamically
    spotifyModel.CLIENT_ID = clientId;

    // AUTHENTICATION FUNCTION
    const authenticateWithToken = async (token: string) => {
        console.log("Attempting auth with token ending in...", token.slice(-5));
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(clientId + ":" + clientSecret)
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: token,
            }),
        });
        const data = await response.json();
        if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
        return data;
    };

    try {
        if (codeData) {
            authData = codeData;
            if (authData.refresh_token) {
                refreshTokenToUse = authData.refresh_token;
                try {
                    await storage.setItem("spotify_refresh_token", authData.refresh_token);
                    console.log("Initial refresh token saved.");
                } catch (e) {
                    console.error("Failed to persist token:", e);
                }
            }
        } else if (refreshTokenToUse) {
            authData = await authenticateWithToken(refreshTokenToUse);
        }

        console.log("Access Token acquired!");

        const newRefreshToken = authData.refresh_token;
        if (newRefreshToken && newRefreshToken !== refreshTokenToUse) {
            refreshTokenToUse = newRefreshToken;
            try {
                await storage.setItem("spotify_refresh_token", newRefreshToken);
                console.log("Refreshed token persisted to storage.");
            } catch (e) {
                console.error("Failed to persist token:", e);
            }
        }

        // Initialize SDK
        spotifysdk = SpotifyApi.withAccessToken(
            clientId,
            {
                access_token: authData.access_token,
                token_type: authData.token_type || "Bearer",
                expires_in: authData.expires_in,
                refresh_token: refreshTokenToUse,
                expires: Date.now() + (authData.expires_in * 1000)
            }
        );

    } catch (e: any) {
        console.error("Critical Auth Error:", e);
        const popup = document.getElementById('spotify-auth-popup');
        if (popup) {
            popup.style.display = 'flex';
        }
    }
}
export { initSpotify };

class SpotifyModel {
    get REDIRECT_URI() {
        if (window.location.hostname === '127.0.0.1') {
            return "http://127.0.0.1:5173/";
        }
        return "https://oliemanq.github.io/DisplayPlusMusic/";
    }
    CLIENT_ID = "";
    SCOPE = ['user-modify-playback-state', 'user-read-playback-state'];

    currentSong = new Song();
    lastSong = new Song();

    imageIndex = 1;
    deviceId = "";

    placeholder_duration = 0;

    async fetchNextTrack(): Promise<Song | undefined> {
        try {
            const queueResponse = await spotifysdk.player.getUsersQueue();
            if (queueResponse && queueResponse.queue && queueResponse.queue.length > 0) {
                const nextTrack = queueResponse.queue[0];
                if (nextTrack.type === 'track') {
                    const track = nextTrack as Track;
                    const nextSong = new Song();
                    nextSong.addID(track.id);
                    nextSong.addTitle(track.name);

                    const artistNames = track.artists.map(artist => artist.name);
                    nextSong.addArtist(artistNames[0]);
                    nextSong.addFeatures(artistNames.slice(1));
                    nextSong.addAlbum(track.album.name);

                    return nextSong;
                }
            }
            return undefined;
        } catch (err: any) {
            console.error("Failed to fetch next track from queue:", err.message || String(err));
            return undefined;
        }
    }

    async fetchCurrentTrack(): Promise<Song> {
        let result;
        try {
            result = await spotifysdk.player.getCurrentlyPlayingTrack();
            if (result && result.device && result.device.id) {
                console.log("Updated device ID from " + this.deviceId + " to " + result.device.id);
                this.deviceId = result.device.id;
            }
        } catch (err: any) {
            console.error("Failed to fetch current track:", err.message || String(err));
            if (err.message && err.message.includes("Premium")) {
                alert("Spotify Premium is required for this feature.");
            }
            return song_placeholder;
        }

        // No item means nothing is playing, or it's paused and Spotify isn't returning it.
        if (!result || !result.item) {
            //console.log("User is not playing anything currently.");
            if (this.lastSong && this.lastSong.songID !== "0") {
                this.lastSong.addisPlaying(false);
                return this.lastSong;
            }
            return song_placeholder;
        }

        if (result.item.type === 'track') {
            const track = result.item as Track;

            if (track.id !== this.lastSong.songID) { // Check if the song has changed
                console.log("Creating new song, ID changed from " + this.lastSong.songID + " to " + track.id);
                const newSong = new Song();
                newSong.addID(track.id);
                newSong.addisPlaying(result.is_playing);
                newSong.addTitle(track.name);

                const artistNames = track.artists.map(artist => artist.name);
                newSong.addArtist(artistNames[0]);
                newSong.addFeatures(artistNames.slice(1));

                newSong.addAlbum(track.album.name);
                newSong.addDurationSeconds(track.duration_ms / 1000);
                newSong.addProgressSeconds(result.progress_ms / 1000);
                newSong.addArtRaw(await this.fetchAlbumArtPng(track));

                newSong.addChangedState(true);

                if (newSong.isPlaying) {
                    console.log(
                        `Updated playing song\n  - ${newSong.title} by ${newSong.artist}\n\n` +
                        (newSong.features.length ? `, featuring ${newSong.features.join(", ")}` : "")
                    );
                } else {
                    console.log(
                        `Updated paused song\n ${newSong.title} by ${newSong.artist}` +
                        (newSong.features.length ? `, featuring ${newSong.features.join(", ")}` : "")
                    );
                }

                this.lastSong = newSong;
                this.currentSong = newSong;
                return newSong;

            } else { // Song hasn't changed, just update dynamic fields
                if (this.lastSong.isPlaying !== result.is_playing) {
                    if (result.is_playing) {
                        console.log(
                            `Resumed: ${this.lastSong.title} by ${this.lastSong.artist}` +
                            (this.lastSong.features.length ? `, featuring ${this.lastSong.features.join(", ")}` : "")
                        );
                    } else {
                        console.log(
                            `Paused: ${this.lastSong.title} by ${this.lastSong.artist}` +
                            (this.lastSong.features.length ? `, featuring ${this.lastSong.features.join(", ")}` : "")
                        );
                    }
                }

                this.lastSong.addisPlaying(result.is_playing);
                this.lastSong.addProgressSeconds(result.progress_ms / 1000);
                this.lastSong.addChangedState(false);

                this.currentSong = this.lastSong;
                return this.lastSong;
            }

        } else if (result.item.type === 'episode') {
            const episode = result.item as Episode;
            const tempSong = new Song();

            tempSong.type = "Episode";
            tempSong.addTitle(episode.name);
            tempSong.addID(episode.id);

            console.log(`Now Playing Episode: ${episode.name} (Show: ${episode.show.name})`);
            this.currentSong = tempSong;


            return tempSong;
        }
        console.log("Broken somehow, return outside of logic")
        return new Song();
    }

    async fetchAlbumArtPng(track: Track): Promise<Uint8Array> {
        let images = track.album.images;

        if (images.length > 1) {
            const imageUrl = images[this.imageIndex].url;
            let art = await downloadImageAsGrayscalePng(imageUrl, 100, 100);
            return art;
        }
        return new Uint8Array();
    }

    async song_Pause() {
        try {
            await spotifysdk.player.pausePlayback(this.deviceId);
        } catch (e) {
            console.error("Failed to pause playback:", e);
        }
    }

    async song_Play() {
        try {
            await spotifysdk.player.startResumePlayback(this.deviceId);
        } catch (e) {
            console.error("Failed to play playback:", e);
        }
    }

    async song_Back() {
        try {
            await spotifysdk.player.skipToPrevious(this.deviceId);
        } catch (e) {
            console.error("Failed to skip to previous track:", e);
        }
    }

    async song_Forward() {
        try {
            await spotifysdk.player.skipToNext(this.deviceId);
        } catch (e) {
            console.error("Failed to skip to next track:", e);
        }
    }
}

const spotifyModel = new SpotifyModel();
export default spotifyModel;