import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,
    RebuildPageContainer,
    TextContainerUpgrade,
    ListContainerProperty,
    ListItemContainerProperty,

} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';
import lyricsPresenter from '../presenter/lyricsPresenter';

// State management variables
let isPageCreated = false;
let isUpdating = false;
let lastSongID: string = "";
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
            yPosition: 13,
            width: 100,
            height: 100,
            containerID: 1,
            containerName: 'album-art',
        });

        const isPaused = songIn.isPlaying ? "  || " : " |> ";
        const buttons = new ListContainerProperty({
            xPosition: 110,
            yPosition: 0,
            width: 52,
            height: 130,
            borderWidth: 0,
            borderRdaius: 0,
            containerID: 2,
            containerName: 'buttons',
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
                itemCount: 3,
                itemWidth: 52,
                itemName: ["  < ", isPaused, "  > "],
                isItemSelectBorderEn: 1
            })
        })


        const songInfoText = songIn.title + "\n" + songIn.artist + "\n" + songIn.album;
        const songInfo = new TextContainerProperty({
            xPosition: 200,
            yPosition: 25,
            width: MAX_WIDTH - (200),
            height: 90,
            borderRdaius: 6,
            borderWidth: 1,
            containerID: 3,
            containerName: 'songInfo',
            content: songInfoText,
            isEventCapture: 0,
        });


        const playbackBarText = formatTime(songIn.progressSeconds) + " / " + formatTime(songIn.durationSeconds) + "\n" + songIn.createPlaybackBar(MAX_WIDTH) + "\n  " + lyricsPresenter.currentLine + "\n    " + lyricsPresenter.nextLine;
        // const playbackBarText = "<".repeat(57);
        const playbackBar = new TextContainerProperty({
            xPosition: 0,
            yPosition: 130,
            width: MAX_WIDTH,
            height: 240,
            borderRdaius: 6,
            borderWidth: 1,
            containerID: 4,
            containerName: 'playbackBar',
            content: playbackBarText,
            isEventCapture: 0,
        })

        const containerConfig = {
            containerTotalNum: 4,
            textObject: [songInfo, playbackBar],
            listObject: [buttons],
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
                        containerID: 3,
                        containerName: 'songInfo',
                        content: songInfoText,
                    });
                    await bridge.textContainerUpgrade(upgrade);

                    const upgrade2 = new TextContainerUpgrade({
                        containerID: 4,
                        containerName: 'playbackBar',
                        content: playbackBarText,
                    })
                    await bridge.textContainerUpgrade(upgrade2);

                } catch (e) {
                    console.error("Failed to upgrade text container:", e);
                }
            }
            // Only update image if it has changed
            if (songIn.albumArtRaw && songIn.albumArtRaw.length > 0 && songIn.songID !== lastSongID) {
                try {
                    await bridge.updateImageRawData(new ImageRawDataUpdate({
                        containerID: 1,
                        containerName: 'album-art',
                        imageData: Array.from(songIn.albumArtRaw),
                    }));
                    console.log("Image data updated successfully");
                    lastSongID = songIn.songID;
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