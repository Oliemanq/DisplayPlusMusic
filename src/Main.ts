import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import { eventHandler } from './presenter/eventPresenter';
import { enableMobileConsole } from './Scripts/debugConsole';
import { fetchLyrics } from './model/lyricsModel';

import pollingPresenter from './presenter/pollingPresenter';

async function main() {
    // enableMobileConsole();
    console.log("App starting...");
    await initSpotify();

    pollingPresenter.startPolling();
    eventHandler();

    const currentSong = await spotifyPresenter.fetchCurrentSong();
    await fetchLyrics(currentSong);
}

main();