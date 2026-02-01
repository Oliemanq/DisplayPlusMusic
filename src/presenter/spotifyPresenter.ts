import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import spotifyModel from '../model/spotfiyModel';
import Song from '../model/songModel';

class SpotifyPresenter {
    readonly SPOTIFY_KEYS: spotifyModel;
    readonly spotifysdk: SpotifyApi;

    currentSong: Song | null = null;
    
    constructor() {
        this.SPOTIFY_KEYS = new spotifyModel();
        this.spotifysdk = this.SPOTIFY_KEYS.spotifysdk;
    }

    async fetchCurrentTrack() {
        const result = await this.spotifysdk.player.getCurrentlyPlayingTrack();

        //checking if item exists
        if (!result || !result.item) {
            console.log("User is not playing anything currently.");
            return;
        }

        if (result.item.type === 'track') {
            const track = result.item as Track;

            this.currentSong = new Song();
            this.currentSong.addTitle(track.name)

            const artistNames = track.artists.map(artist => artist.name);
            this.currentSong.addArtist(artistNames[0]);
            this.currentSong.addFeatures(artistNames.slice(1)); //slice returns all elements after given index

            this.currentSong.addAlbum(track.album.name);

            console.log(`Now Playing: ${this.currentSong.title} by ${this.currentSong.artist}, featuring ${this.currentSong.features.join(" ,")}`);
        
        } else if (result.item.type === 'episode') {
            const episode = result.item as Episode;

            this.currentSong = new Song();
            this.currentSong.type = "Episode";
            this.currentSong.addTitle(episode.name);

            console.log(`Now Playing Episode: ${episode.name} (Show: ${episode.show.name})`);
        }
    }
}

export default SpotifyPresenter;