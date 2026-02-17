import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import { eventHandler } from './presenter/eventPresenter';
import { enableMobileConsole } from './Scripts/debugConsole';

async function main() {
    //enableMobileConsole();
    console.log("App starting...");
    await initSpotify();

    spotifyPresenter.startPolling();
    eventHandler();
}

main();