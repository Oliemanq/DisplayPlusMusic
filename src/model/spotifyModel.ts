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
    lastSongID = '';

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
            const tempSong = new Song()
            const track = result.item as Track;

            tempSong.addTitle(track.name);

            const artistNames = track.artists.map(artist => artist.name);
            tempSong.addArtist(artistNames[0]);
            tempSong.addFeatures(artistNames.slice(1));
            tempSong.addAlbum(track.album.name);

            tempSong.addID(track.id);

            console.log(
                `Now Playing: ${tempSong.title} by ${tempSong.artist}` +
                (tempSong.features.length ? `, featuring ${tempSong.features.join(", ")}` : "")
            );
            this.lastSongID = this.currentSong.songID
            this.currentSong = tempSong;
            return tempSong;

        } else if (result.item.type === 'episode') {
            const episode = result.item as Episode;
            const tempSong = new Song();

            tempSong.type = "Episode";
            tempSong.addTitle(episode.name);
            tempSong.addID(episode.id);

            console.log(`Now Playing Episode: ${episode.name} (Show: ${episode.show.name})`);
            this.lastSongID = this.currentSong.songID;
            this.currentSong = tempSong;
            return tempSong;
        }
        console.log("Broken somehow, return outside of logic")
        return new Song();
    }

    async fetchAlbumArt(): Promise<Blob> {
        let result;
        try {
            result = await spotifysdk.player.getCurrentlyPlayingTrack();
        } catch (err) {
            console.error("Failed to fetch currently playing track:", err);
            return new Blob();
        }

        // No item means nothing is playing.
        if (!result || !result.item) {
            console.log("User is not playing anything currently.");
            return new Blob();
        }

        console.log(`New Track Detected: ${result.item.name}`);
        this.lastSongID = result.item.id;

        if (result.item.type === 'track') {
            let track = result.item as Track
            
            let images = track.album.images;

            if (images.length > 0) {
                const imageUrl = images[1].url;
                
                console.log("Found image, returning blob")
                let art = await downloadImage(imageUrl);

                const imgElement = document.getElementById('album-art') as HTMLImageElement;
                if (imgElement) {
                    imgElement.src = URL.createObjectURL(art);
                }
                console.log("blob info prints \nart.size " + art.size + "\nart.type " + art.type + "\nart.text " + art.text + "\nart.stream " + art.stream);
                return art;
            }
        }

        console.log("Track is not a song and doesn't have art. Returning blank")
        return new Blob();
    }
}

const spotifyModel = new SpotifyModel();
export default spotifyModel;
export const fetchCurrentTrack = spotifyModel.fetchCurrentTrack.bind(spotifyModel);