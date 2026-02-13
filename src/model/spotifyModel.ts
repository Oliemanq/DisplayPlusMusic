import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import Song from '../model/songModel';
import { downloadImage, downloadImageAsBase64, downloadImageAsGrayscalePng } from "./imageModel";
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

let spotifysdk!: SpotifyApi;

async function initSpotify(): Promise<void> {
    // Check for localhost to prevent consuming the token on the PC
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log("Running on PC. Skipping Auth to preserve Refresh Token for mobile.");
        alert("Skipping Auth on PC to save token for phone. Open on Mobile!");
        return;
    }

    // PASTE YOUR REFRESH TOKEN HERE
    // PASTE YOUR REFRESH TOKEN HERE
    const HARDCODED_REFRESH_TOKEN = "AQBikJeJAlUiFwAxcN8iXg8IhCqAx9fjgqR4PRIJ6vzTYXdb90JcczSJAG906aWue_44URnkyWOS0Vqjw2TiMAu0bi8qrEhDwhYPL1YwhV0HuC6d5aSEeI1FZN7m2gIXOtk";

    // Logic to resolve which token to use
    let refreshTokenToUse = HARDCODED_REFRESH_TOKEN;
    let usingStoredToken = false;

    try {
        const bridge = await waitForEvenAppBridge();
        const storedToken = await bridge.getLocalStorage("spotify_refresh_token");
        if (storedToken && storedToken.length > 20 && storedToken !== "PASTE_YOUR_REFRESH_TOKEN_HERE") {
            console.log("Found stored refresh token, attempting to use it.");
            refreshTokenToUse = storedToken;
            usingStoredToken = true;
        }
    } catch (e) {
        console.error("Error accessing bridge storage:", e);
    }

    if (refreshTokenToUse === "PASTE_YOUR_REFRESH_TOKEN_HERE") {
        console.error("No Refresh Token provided!");
        alert("Setup Required: Valid Refresh Token missing.");
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
                const bridge = await waitForEvenAppBridge();
                await bridge.setLocalStorage("spotify_refresh_token", newRefreshToken);
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
        alert("Authentication Failed. Please check your internet or regenerate the token.");
    }
}
export { initSpotify };

class SpotifyModel {
    ALBUM_ART_PATH = ('../src/assets/current_album_art.jpg');
    REDIRECT_URI = `${window.location.origin}/`;
    CLIENT_ID = '29a961338df9480db3c1b50e10df184f';
    SCOPE = ['user-modify-playback-state', 'user-read-playback-state'];

    currentSong = new Song();
    lastSong = new Song();

    imageIndex = 1;

    async fetchCurrentTrack(): Promise<Song> {
        let result;
        try {
            result = await spotifysdk.player.getCurrentlyPlayingTrack();
        } catch (err) {
            console.error("Failed to fetch currently playing track:", err);
            return new Song();
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
                newSong.addArt(await this.fetchAlbumArt(track));
                newSong.addArtBase64(await this.fetchAlbumArtBase64(track));
                newSong.addArtRaw(await this.fetchAlbumArtPng(track));

                newSong.addChangedState(true);

                if (newSong.isPlaying) {
                    console.log(
                        `Updated playing song\n  - ${newSong.title} by ${newSong.artist}` +
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

    async fetchAlbumArt(track: Track): Promise<Blob> {
        let images = track.album.images;

        if (images.length > 1) {
            const imageUrl = images[this.imageIndex].url;
            console.log("Fetched image " + this.imageIndex + ", height is " + images[this.imageIndex].height + " and the width is " + images[this.imageIndex].width);
            let art = await downloadImage(imageUrl);

            const imgElement = document.getElementById('album-art') as HTMLImageElement;
            if (imgElement) {
                imgElement.src = URL.createObjectURL(art);
            }
            return art;
        }
        console.log("Track is not a song and doesn't have art. Returning blank")
        return new Blob();
    }
    async fetchAlbumArtBase64(track: Track): Promise<string> {
        let images = track.album.images;

        if (images.length > 1) {
            const imageUrl = images[this.imageIndex].url;

            console.log("Found image, returning blob")
            let art = await downloadImageAsBase64(imageUrl);

            const imgElement = document.getElementById('album-art') as HTMLImageElement;
            if (imgElement) {
                imgElement.src = art;
            }
            return art;
        }
        console.log("Track is not a song and doesn't have art. Returning blank")
        return "";
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
}

const spotifyModel = new SpotifyModel();
export default spotifyModel;