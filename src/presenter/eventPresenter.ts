import { List_ItemEvent, EvenHubEvent, EvenHubEventType, evenHubEventFromJson, waitForEvenAppBridge, OsEventTypeList } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';


export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent(async (event) => {
        const listEvent = event.listEvent;
        const sysEvent = event.sysEvent;
        if (listEvent) { // Tapping on list item (buttons)
            console.log(listEvent.currentSelectItemIndex + " " + listEvent.currentSelectItemName);
                if (spotifyPresenter.getActiveSource() === 'navidrome') {
                    return;
                }
            switch (listEvent.currentSelectItemIndex) { //checking what button was clicked
                case 1:  //button 1, pause play
                    spotifyPresenter.song_pauseplay();
                    break;
                case 2:  //button 2, forward
                    spotifyPresenter.song_forward();
                    break;
                default:  //button 3, back
                    spotifyPresenter.song_back();
                    break;
            }
        }
        if (event.sysEvent) {
            const eventType = event.sysEvent.eventType;
            if (eventType == OsEventTypeList.DOUBLE_CLICK_EVENT) {
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
