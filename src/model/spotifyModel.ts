import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import Song from '../model/songModel';
import { downloadImageAsGrayscalePng } from "./imageModel";
import { storage } from '../utils/storage';
import { generateRefreshToken, checkForAuthCode } from '../Scripts/get_refresh_token';
import placeholderArt from '../Assets/placeholder_art.jpg';

let spotifysdk!: SpotifyApi;

async function initSpotify(): Promise<void> {
    const HARDCODED_REFRESH_TOKEN = import.meta.env.VITE_SPOTIFY_REFRESH_TOKEN;

    // Check if we are returning from an auth redirect
    const codeRefreshToken = await checkForAuthCode();

    // Logic to resolve which token to use
    let refreshTokenToUse = codeRefreshToken || HARDCODED_REFRESH_TOKEN;
    let usingStoredToken = false;

    // If we got a new token from the code exchange, save it immediately
    if (codeRefreshToken) {
        console.log("New Refresh Token obtained from code exchange!", codeRefreshToken);
        // Show in UI
        (document.getElementById('refresh-token') as HTMLInputElement).value = codeRefreshToken;

        try {
            await storage.setItem("spotify_refresh_token", codeRefreshToken);
            usingStoredToken = true;
        } catch (e) {
            console.error("Failed to persist new token:", e);
        }
    } else {
        // Try to load from storage if we didn't just get one
        try {
            const storedToken = await storage.getItem("spotify_refresh_token");
            if (storedToken && storedToken.length > 20 && storedToken !== "PASTE_YOUR_REFRESH_TOKEN_HERE") {
                console.log("Found stored refresh token, attempting to use it.");
                refreshTokenToUse = storedToken;
                usingStoredToken = true;
            }
        } catch (e) {
            console.error("Error accessing bridge storage:", e);
        }
    }

    if (refreshTokenToUse === "PASTE_YOUR_REFRESH_TOKEN_HERE") {
        console.error("No Refresh Token provided!");
        //alert("Setup Required: Valid Refresh Token missing.");
        return;
    }

    // AUTHENTICATION FUNCTION
    const authenticateWithToken = async (token: string) => {
        console.log("Attempting auth with token ending in...", token.slice(-5));
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: spotifyModel.CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: token,
            }),
        });
        const data = await response.json();
        if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
        return data;
    };

    // Attempt Auth with retries
    let authData;
    try {
        try {
            authData = await authenticateWithToken(refreshTokenToUse);
        } catch (err) {
            // If we failed using the stored token, try the hardcoded one as fallback
            if (usingStoredToken && refreshTokenToUse !== HARDCODED_REFRESH_TOKEN) {
                console.warn("Stored token failed, falling back to hardcoded token...");
                //alert("Restoring connection with new token...");
                authData = await authenticateWithToken(HARDCODED_REFRESH_TOKEN);
                // If this worked, we should update the storage immediately
                usingStoredToken = false;
            } else {
                throw err;
            }
        }

        console.log("Access Token acquired!");

        // Update persistence if we have a new refresh token OR if we successfully fell back to hardcoded
        const newRefreshToken = authData.refresh_token || (usingStoredToken ? undefined : HARDCODED_REFRESH_TOKEN);

        if (newRefreshToken) {
            try {
                await storage.setItem("spotify_refresh_token", newRefreshToken);
                console.log("Refreshed token persisted to storage.");
            } catch (e) {
                console.error("Failed to persist token:", e);
            }
        }

        // Initialize SDK
        spotifysdk = SpotifyApi.withAccessToken(
            spotifyModel.CLIENT_ID,
            {
                access_token: authData.access_token,
                token_type: authData.token_type || "Bearer",
                expires_in: authData.expires_in,
                refresh_token: newRefreshToken || refreshTokenToUse,
                expires: Date.now() + (authData.expires_in * 1000)
            }
        );

    } catch (e: any) {
        console.error("Critical Auth Error:", e);
        const popup = document.getElementById('spotify-auth-popup');
        if (popup) {
            popup.style.display = 'flex';
        }
        //alert("Authentication Failed. Please check your internet or regenerate the token.");
    }
}
export { initSpotify };

class SpotifyModel {
    REDIRECT_URI = `${window.location.origin}/`;
    CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENTID;
    SCOPE = ['user-modify-playback-state', 'user-read-playback-state'];

    currentSong = new Song();
    lastSong = new Song();

    imageIndex = 1;
    deviceId = "";

    placeholder_duration = 0;

    async fetchCurrentTrack(): Promise<Song> {
        let result;
        try {
            result = await spotifysdk.player.getCurrentlyPlayingTrack();
            if (result && result.device && result.device.id) {
                this.deviceId = result.device.id;
            }
        } catch (err) {
            let placeholder_song = new Song()
            placeholder_song.addTitle("Honestly");
            placeholder_song.addArtist("THØRNS");
            placeholder_song.addFeatures(["Kasane Teto"]);
            placeholder_song.addAlbum("Honestly");
            placeholder_song.addID("0");
            placeholder_song.addProgressSeconds(this.placeholder_duration);
            this.placeholder_duration += 2;
            if (this.placeholder_duration > 210) {
                this.placeholder_duration = 0;
            }
            placeholder_song.addDurationSeconds(210);
            try {
                placeholder_song.addArtRaw(await downloadImageAsGrayscalePng(placeholderArt, 100, 100));
            } catch (e) {
                console.error("Failed to load placeholder art:", e);
                placeholder_song.addArtRaw(new Uint8Array());
            }
            placeholder_song.addisPlaying(true);
            placeholder_song.addChangedState(false);
            return placeholder_song;
        }

        // No item means nothing is playing.
        if (!result || !result.item) {
            //console.log("User is not playing anything currently.");
            return new Song();
        }

        if (result.item.type === 'track') {
            const track = result.item as Track;

            if (track.id !== this.lastSong.songID) { // Check if the song has changed
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
            let state = await spotifysdk.player.getPlaybackState();
            if (state.is_playing) {
                await spotifysdk.player.pausePlayback(this.deviceId);
            } else {
                await spotifysdk.player.startResumePlayback(this.deviceId);
            }
        } catch (e) {
            console.error("Failed to pause playback:", e);
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