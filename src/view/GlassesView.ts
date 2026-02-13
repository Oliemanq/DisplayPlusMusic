import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,
    RebuildPageContainer,
    TextContainerUpgrade,

} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';

// State management variables
let isPageCreated = false;
let isUpdating = false;
let lastImageRaw: Uint8Array | undefined = undefined;
let lastConfig: string = "";
let MAX_HEIGHT = 288;
let MAX_WIDTH = 576

async function createView(songIn: Song) {
    // Basic concurrency guard
    if (isUpdating) {
        console.log("Skipping update - previous update still in progress");
        return;
    }

    isUpdating = true;

    try {
        const bridge = await waitForEvenAppBridge();

        const imageContainer = new ImageContainerProperty({
            xPosition: 0,
            yPosition: 0,
            width: 100,
            height: 100,
            containerID: 3,
            containerName: 'album-art',
        });

        const text = songIn.title + " - " + songIn.artist + "\n" + formatTime(songIn.progressSeconds) + " > " + formatTime(songIn.durationSeconds);
        const textContainer = new TextContainerProperty({
            xPosition: 0,
            yPosition: 110,
            width: 300,
            height: MAX_HEIGHT,
            borderRdaius: 6,
            borderWidth: 1,
            containerID: 1,
            containerName: 'text-1',
            content: text,
            isEventCapture: 1,
        });

        const containerConfig = {
            containerTotalNum: 2,
            textObject: [textContainer],
            imageObject: [imageContainer],
        };

        // If page is not created, try to create it.
        if (!isPageCreated) {
            const container = new CreateStartUpPageContainer(containerConfig);
            const result = await bridge.createStartUpPageContainer(container);

            if (result === 0) {
                console.log('Container created successfully');
                isPageCreated = true;
                const layoutConfig = {
                    ...containerConfig,
                    textObject: containerConfig.textObject?.map((t: any) => ({ ...t, content: '' }))
                };
                lastConfig = JSON.stringify(layoutConfig);
            } else if (result === 1) {
                // Result 1 (invalid) likely means container already exists.
                // Mark as created so we proceed to rebuild next.
                console.log('Container creation returned invalid (1), assuming already exists. Switching to rebuild mode.');
                isPageCreated = true;
            } else {
                console.error('Failed to create container:', result);
                return; // Exit if a critical error occurred (oversize, out of memory, etc.)
            }
        }

        // If page is created (or existed), rebuild/update it.
        // If page is created (or existed), rebuild/update it.
        if (isPageCreated) {
            // Create a layout-only config for comparison (exclude dynamic content)
            const layoutConfig = {
                ...containerConfig,
                textObject: containerConfig.textObject?.map((t: any) => ({ ...t, content: '' }))
            };
            const currentLayoutStr = JSON.stringify(layoutConfig);

            if (currentLayoutStr !== lastConfig) {
                // Config changed, rebuild
                console.log("Layout config changed, rebuilding page container...");
                const rebuildContainer = new RebuildPageContainer(containerConfig);
                await bridge.rebuildPageContainer(rebuildContainer);
                lastConfig = currentLayoutStr;
            } else {
                // If config hasn't changed, try to just upgrade the text content
                // This avoids clearing the screen/image
                try {
                    const upgrade = new TextContainerUpgrade({
                        containerID: 1,
                        containerName: 'text-1',
                        content: text,
                    });
                    await bridge.textContainerUpgrade(upgrade);
                } catch (e) {
                    console.error("Failed to upgrade text container:", e);
                }
            }

            console.log("Checking image update. Raw length:", songIn.albumArtRaw?.length, "Last length:", lastImageRaw?.length);

            // Only update image if it has changed
            if (songIn.albumArtRaw && songIn.albumArtRaw.length > 0 && songIn.albumArtRaw !== lastImageRaw) {
                try {
                    console.log("Updating image container due to change")
                    await bridge.updateImageRawData(new ImageRawDataUpdate({
                        containerID: 3,
                        containerName: 'album-art',
                        imageData: Array.from(songIn.albumArtRaw),
                    }));
                    console.log("Image data updated successfully");
                    lastImageRaw = songIn.albumArtRaw;
                } catch (e) {
                    console.error("Failed to update image data:", e);
                }
            }
        }
    } catch (e) {
        console.error("Error in createView:", e);
    } finally {
        isUpdating = false;
    }
}

export { createView };