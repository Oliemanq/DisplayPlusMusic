import { List_ItemEvent, EvenHubEvent, EvenHubEventType, evenHubEventFromJson, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";


export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        if (event.listEvent) {
            console.log(event.listEvent.currentSelectItemIndex + " " + event.listEvent.currentSelectItemName);
        } else if (event.textEvent) {
            console.log(event.textEvent.eventType);
        } else if (event.sysEvent) {
            console.log(event.sysEvent.eventType);
        } else {
            console.log("Audio event");
        }
    });

    unsubscribe();
}