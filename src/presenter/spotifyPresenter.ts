import { SpotifyApi, Track, Episode } from "@spotify/web-api-ts-sdk";
import SPOTIFY_KEYS from '../model/spotifyModel';
import Song from '../model/songModel';

const spotifysdk = SpotifyApi.withClientCredentials(
    SPOTIFY_KEYS.USER_CLIENTID, 
    SPOTIFY_KEYS.USER_CLIENTSECRET, 
    SPOTIFY_KEYS.SCOPE
)

class SpotifyPresenter {
    currentSong: Song | null = null;

    async fetchCurrentTrack() {
        const result = await spotifysdk.player.getCurrentlyPlayingTrack();
        console.log("fetched current track for \n " + SPOTIFY_KEYS.USER_CLIENTID + " client id" + "\n" + SPOTIFY_KEYS.USER_CLIENTSECRET + " client secret" + "\n " + result);

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

const spotifyPresenter = new SpotifyPresenter();

export default spotifyPresenter
export const fetchCurrentTrack = spotifyPresenter.fetchCurrentTrack.bind(spotifyPresenter);