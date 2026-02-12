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
  async downloadImageAsBMP(url: string): Promise<Blob> {
    const blob = await this.downloadImage(url);
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;

    let blobBmp: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        blobBmp = await canvas.convertToBlob({ type: 'image/bmp' });
      }
    }

    if (!blobBmp) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        blobBmp = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/bmp'));
      }
    }

    if (!blobBmp) {
      throw new Error('Failed to convert image to BMP');
    }

    return blobBmp;
  }
}

const imageModel = new ImageModel
export const downloadImage = imageModel.downloadImage.bind(imageModel);
export const downloadImageAsBase64 = imageModel.downloadImageAsBase64.bind(imageModel);
export const downloadImageAsBMP = imageModel.downloadImageAsBMP.bind(imageModel);