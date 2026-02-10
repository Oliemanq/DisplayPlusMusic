import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import Song from '../model/songModel';
import { downloadImage } from "./imageModel";

let spotifysdk!: SpotifyApi;

async function initSpotify(): Promise<void> {
    spotifysdk = SpotifyApi.withUserAuthorization(
        spotifyModel.CLIENT_ID,
        spotifyModel.REDIRECT_URI,
        spotifyModel.SCOPE
    );

    // Check whether we already have an access token (i.e. we just came back from
    // the Spotify redirect and the SDK auto-exchanged the code).
    const token = await spotifysdk.getAccessToken();

    if (!token) {
        // No token yet — kick off the PKCE auth redirect to Spotify.
        console.log("No token found. Redirecting to Spotify for authorization...");
        await spotifysdk.authenticate();
        // authenticate() will navigate away; code below won't run until we're back.
    } else {
        console.log("Access token acquired successfully.");
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
            console.log("User is not playing anything currently.");
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
            const imageUrl = images[1].url;

            console.log("Found image, returning blob")
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
}

const spotifyModel = new SpotifyModel();
export default spotifyModel;