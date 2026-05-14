import { List_ItemEvent, EvenHubEvent, EvenHubEventType, evenHubEventFromJson, waitForEvenAppBridge, OsEventTypeList } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';


export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        if (event.listEvent) {
            console.log(event.listEvent.currentSelectItemIndex + " " + event.listEvent.currentSelectItemName);
            switch (event.listEvent.currentSelectItemIndex) {
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

        if (event.textEvent?.eventType == OsEventTypeList.DOUBLE_CLICK_EVENT) {
            console.log('double tap event, shutting down app');
            bridge.shutDownPageContainer();
        }
    });

    // Return unsubscribe in case we need to stop listening later
    return unsubscribe;
}