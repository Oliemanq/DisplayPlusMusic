import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    ListContainerProperty,
    TextContainerProperty,
    ImageContainerProperty,
  } from '@evenrealities/even_hub_sdk';
import imagePresenter from './presenter/imagePresenter';

async function createView() {
    const bridge = await waitForEvenAppBridge();

    const mediaInfoContainer: TextContainerProperty = {
        xPosition: 0,
        yPosition: 0,
        width: 200,
        height: 50,
        containerID: 1,
        containerName: 'mediaInfoContainer',
        content: 'Media info',
        isEventCapture: 0,
        toJson: function (): Record<string, any> {
            throw new Error('Function not implemented.');
        }
    };
    const albumArtContainer: ImageContainerProperty = {
        xPosition: 0,
        yPosition: 60,
        width: 200,
        height: 200,
        containerID: 2,
        containerName: 'albumArtContainer',
        toJson: function (): Record<string, any> {
            throw new Error('Function not implemented.');
        }
    }

    const container: CreateStartUpPageContainer = {
        containerTotalNum: 2,
        textObject: [mediaInfoContainer],
        imageObject: [albumArtContainer],
        toJson: function (): Record<string, any> {
            throw new Error('Function not implemented.');
        }
    }

    const result = await bridge.createStartUpPageContainer(container);
    if (result === 0) {
        console.log('Container created successfully');

        // If there are image containers, call updateImageRawData immediately after success to display image content
        await bridge.updateImageRawData({
            containerID: 2,
            containerName: 'albumArtContainer',
            imageData: [],
            toJson: function (): Record<string, any> {
                throw new Error('Function not implemented.');
            }
        });
        } else {
        console.error('Failed to create container:', result);
    }
}

export default createView;