import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import { createView } from './view/GlassesView';
import { enableMobileConsole } from './Scripts/debugConsole';

async function main() {
    enableMobileConsole();
    console.log("App starting...");
    await initSpotify();


    spotifyPresenter.startPolling();
}

main();