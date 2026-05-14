import { List_ItemEvent, EvenHubEvent, EvenHubEventType, evenHubEventFromJson, waitForEvenAppBridge, OsEventTypeList } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';


export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        const listEvent = event.listEvent;
        const sysEvent = event.sysEvent;
        if (listEvent) {
            console.log(listEvent.currentSelectItemIndex + " " + listEvent.currentSelectItemName);
            switch (listEvent.currentSelectItemIndex) {
                case 1:
                    spotifyPresenter.song_pauseplay();
                    break;
                case 2:
                    spotifyPresenter.song_forward();
                    break;
                default:
                    spotifyPresenter.song_back();
                    break;
            }
        }
        if (event.sysEvent) {
            const eventType = event.sysEvent.eventType;
            if (eventType == OsEventTypeList.DOUBLE_CLICK_EVENT) {
                console.log('double tap event, shutting down app');
                bridge.shutDownPageContainer(1);
            }
        }
    });

    // Return unsubscribe in case we need to stop listening later
    return unsubscribe;
}