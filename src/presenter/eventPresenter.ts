import { List_ItemEvent, EvenHubEvent, EvenHubEventType, evenHubEventFromJson, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';
import { blankScreen, unblankScreen, isScreenBlanked } from '../view/GlassesView';


export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        if (event.sysEvent) {
            console.log(event.sysEvent.eventType);
            if ((event.sysEvent.eventType ?? 0) === 3) {
                if (isScreenBlanked()) {
                    unblankScreen();
                } else {
                    blankScreen();
                }
            }
            return;
        }

        if (isScreenBlanked()) return;

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
        } else if (event.textEvent) {
            console.log(event.textEvent.eventType);
        } else {
            console.log("Audio event");
        }
    });

    // Return unsubscribe in case we need to stop listening later
    return unsubscribe;
}
