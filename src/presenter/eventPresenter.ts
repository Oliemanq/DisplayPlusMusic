import { waitForEvenAppBridge, OsEventTypeList } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';

const PLAYBACK_BUTTONS = {
    previous: '◁◁',
    playPause: '▷ll',
    next: '▷▷',
} as const;

export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent(async (event) => {
        const listEvent = event.listEvent;
        const sysEvent = event.sysEvent;
        const menuItemClickEvent = event.menuItemClickEvent;

        if (listEvent?.containerName === 'buttons') {
            const buttonName = listEvent.currentSelectItemName?.trim();
            console.log(`${listEvent.currentSelectItemIndex ?? ''} ${buttonName ?? ''}`);

            // SDK versions have reported both zero- and one-based indexes. Prefer
            // the stable item name and keep the index fallback for older firmware.
            switch (buttonName) {
                case PLAYBACK_BUTTONS.previous:
                    spotifyPresenter.song_back();
                    break;
                case PLAYBACK_BUTTONS.playPause:
                    spotifyPresenter.song_pauseplay();
                    break;
                case PLAYBACK_BUTTONS.next:
                    spotifyPresenter.song_forward();
                    break;
                default:
                    switch (listEvent.currentSelectItemIndex) {
                        case 0:
                        case 3:
                            spotifyPresenter.song_back();
                            break;
                        case 1:
                            spotifyPresenter.song_pauseplay();
                            break;
                        case 2:
                            spotifyPresenter.song_forward();
                            break;
                    }
            }
        }

        if (menuItemClickEvent && menuItemClickEvent.itemID) { // Tapping on menu item
            console.log('Menu item clicked:', menuItemClickEvent.itemID);
            if (menuItemClickEvent.itemID === 1) {
                spotifyPresenter.toggleMiniMode();
            } else if (menuItemClickEvent.itemID === 2) {
                spotifyPresenter.toggleMiniMode();
            }
        }

        if (sysEvent) { // Tapping on system event (double tap)
            if (sysEvent.eventType == OsEventTypeList.DOUBLE_CLICK_EVENT) {
                console.log('double tap event, shutting down app');
                if (await bridge.shutDownPageContainer(1)) {
                    console.log("successfull shutdown");
                } else {
                    console.log("failed shutdown");
                }
            }
        }
    });

    // Return unsubscribe in case we need to stop listening later
    return unsubscribe;
}
