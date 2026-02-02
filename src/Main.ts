import { initSpotify } from './model/spotifyModel';
import spotifyModel from './model/spotifyModel';
import createView from './view/GlassesView';

async function main() {

    await initSpotify();

    spotifyModel.fetchCurrentTrack();

    spotifyModel.fetchAlbumArt();


}

main();