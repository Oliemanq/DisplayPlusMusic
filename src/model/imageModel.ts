import { encodeGrayscalePng } from '../Scripts/pngEncoder';

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
  async downloadImageAsGrayscalePng(url: string, targetWidth?: number, targetHeight?: number): Promise<Uint8Array> {
    const blob = await this.downloadImage(url);
    const bitmap = await createImageBitmap(blob);
    let width = bitmap.width;
    let height = bitmap.height;

    // Use target dimensions if provided
    if (targetWidth && targetHeight) {
      width = targetWidth;
      height = targetHeight;
    }

    let canvas: OffscreenCanvas | HTMLCanvasElement;
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw image to fit the target dimensions
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const grayscaleData = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      // Standard grayscale formula
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      grayscaleData[i] = avg;
    }

    return encodeGrayscalePng(width, height, grayscaleData);
  }
}

const imageModel = new ImageModel
export const downloadImage = imageModel.downloadImage.bind(imageModel);
export const downloadImageAsBase64 = imageModel.downloadImageAsBase64.bind(imageModel);
export const downloadImageAsGrayscalePng = imageModel.downloadImageAsGrayscalePng.bind(imageModel);