import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import createView from './view/GlassesView';

async function main() {

    await initSpotify();

    spotifyPresenter.startPolling();


}

main();