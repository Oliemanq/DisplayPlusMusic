import spotifyModel from '../model/spotifyModel';
import Song from '../model/songModel';

class SpotifyPresenter {    
    currentSong = spotifyModel.fetchCurrentTrack();
    
}

const spotifyPresenter = new SpotifyPresenter();

export default spotifyPresenter;
