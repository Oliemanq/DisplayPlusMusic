class ImageModel {
    async downloadImage(url: string): Promise<Blob> {
        const response = await fetch(url);
        
        if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        return await response.blob();
    }
    async downloadImageAsBase64(url: string): Promise<string> {
        const blob = await downloadImage(url);
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
}

const imageModel = new ImageModel
export const downloadImage = imageModel.downloadImage.bind(imageModel);