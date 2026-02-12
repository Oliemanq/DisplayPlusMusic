import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,
    RebuildPageContainer,

} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';

// State management variables
let isPageCreated = false;
let isUpdating = false;
let lastImageBase64: string | undefined = undefined;
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
            xPosition: 300,
            yPosition: 0,
            width: 200,
            height: 50,
            containerID: 3,
            containerName: 'album-art',
        });

        const text = songIn.title + " - " + songIn.artist + "\n" + formatTime(songIn.progressSeconds) + " > " + formatTime(songIn.durationSeconds);
        const textContainer = new TextContainerProperty({
            xPosition: 0,
            yPosition: 0,
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
            imageObject: [imageContainer],
            textObject: [textContainer],
        };

        // If page is not created, try to create it.
        if (!isPageCreated) {
            const container = new CreateStartUpPageContainer(containerConfig);
            const result = await bridge.createStartUpPageContainer(container);

            if (result === 0) {
                console.log('Container created successfully');
                isPageCreated = true;
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
        if (isPageCreated) {
            // Use RebuildPageContainer for updates
            const rebuildContainer = new RebuildPageContainer(containerConfig);
            const result = await bridge.rebuildPageContainer(rebuildContainer);

            if (result) {
                // Only update image if it has changed
                try {
                    await bridge.updateImageRawData(new ImageRawDataUpdate({
                        containerID: 3,
                        containerName: 'album-art',
                        imageData: await songIn.albumArtBMP.arrayBuffer(),
                    }));
                    console.log("Image data updated successfully");
                    lastImageBase64 = songIn.albumArtBase64;
                } catch (e) {
                    console.error("Failed to update image data:", e);
                }
            } else {
                console.warn("Failed to rebuild page container - possibly busy or disconnected. Will retry next cycle.");
            }
        }
    } catch (e) {
        console.error("Error in createView:", e);
    } finally {
        isUpdating = false;
    }
}

export { createView };