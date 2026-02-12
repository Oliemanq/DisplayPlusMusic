import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    ListContainerProperty,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,

} from '@evenrealities/even_hub_sdk';

async function createView() {
    const bridge = await waitForEvenAppBridge();

    const mediaInfoContainer = new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: 200,
        height: 50,
        containerID: 1,
        containerName: 'mediaInfoContainer',
        content: 'Media info',
        isEventCapture: 0,
    });

    const albumArtContainer = new ImageContainerProperty({
        xPosition: 0,
        yPosition: 60,
        width: 200,
        height: 200,
        containerID: 2,
        containerName: 'albumArtContainer',
    });

    const container = new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [mediaInfoContainer],
        imageObject: [albumArtContainer],
    });

    const result = await bridge.createStartUpPageContainer(container);
    if (result === 0) {
        console.log('Container created successfully');

        // If there are image containers, call updateImageRawData immediately after success to display image content
        await bridge.updateImageRawData(new ImageRawDataUpdate({
            containerID: 2,
            containerName: 'albumArtContainer',
            imageData: [],
        }));
    } else {
        console.error('Failed to create container:', result);
    }
}

export { createView };