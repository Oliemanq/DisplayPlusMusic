import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import { eventHandler } from './presenter/eventPresenter';
import { enableMobileConsole } from './Scripts/debugConsole';
import { fetchLyrics } from './model/lyricsModel';
import pollingPresenter from './presenter/pollingPresenter';
import viewPresenter from './presenter/viewPresenter';

async function main() {
    enableMobileConsole();
    console.log("App starting...");

    viewPresenter.initListeners();

    pollingPresenter.startPolling();


    await initSpotify();

    eventHandler();

    const currentSong = await spotifyPresenter.fetchCurrentSong();
    await fetchLyrics(currentSong);
}

main();