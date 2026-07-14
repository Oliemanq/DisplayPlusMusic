import { encodeGrayscalePng } from '../Scripts/pngEncoder';

class ImageModel {
  async _fetchBlob(source: string | Blob): Promise<Blob> {
    if (source instanceof Blob) {
      return source;
    }

    try {
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`[ImageModel] _fetchBlob successfully built blob of size: ${blob.size}`);
      return blob;
    } catch (error) {
      console.error(`[ImageModel] Error in _fetchBlob:`, error);
      throw error;
    }
  }

  async downloadImage(source: string | Blob, targetWidth?: number, targetHeight?: number): Promise<Uint8Array> {
    console.log(`[ImageModel] downloadImage started (target: ${targetWidth}x${targetHeight})`);
    const blob = await this._fetchBlob(source);
    const bitmap = await createImageBitmap(blob);
    let width = bitmap.width;
    let height = bitmap.height;
    console.log(`[ImageModel] downloadImage original bitmap dimensions: ${width}x${height}`);

    // Use target dimensions if provided
    if (targetWidth && targetHeight) {
      width = targetWidth;
      height = targetHeight;
      console.log(`[ImageModel] downloadImage resizing to target dimensions: ${width}x${height}`);
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

    // Enable smoothing to avoid pixelation when scaling
    try {
      // Some contexts (OffscreenCanvas) support these properties
      // @ts-ignore
      ctx.imageSmoothingEnabled = true;
      // @ts-ignore
      ctx.imageSmoothingQuality = 'high';
    } catch (e) {
      // Ignore if context doesn't expose these properties
    }

    // Draw image to fit the target dimensions (with smoothing)
    ctx.drawImage(bitmap, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
        canvas.convertToBlob({ type: 'image/png' })
          .then(resolve)
          .catch(reject);
      } else if (canvas instanceof HTMLCanvasElement) {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/png');
      } else {
        reject(new Error('Unsupported canvas type'));
      }
    });

    console.log(`[ImageModel] downloadImage pngBlob generated, size: ${pngBlob.size}`);

    const arrayBuffer = await pngBlob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async downloadImageAsBase64(source: string | Blob): Promise<string> {
    const blob = await this._fetchBlob(source);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (e) => {
        console.error(`[ImageModel] Error in downloadImageAsBase64:`, e);
        reject(e);
      };
      reader.readAsDataURL(blob);
    });
  }

  async uint8ArrayToBase64(buffer: Uint8Array): Promise<string> {
    const blob = new Blob([buffer as any], { type: 'image/png' });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async downloadImageAsGrayscalePng(source: string | Blob, targetWidth?: number, targetHeight?: number): Promise<Uint8Array> {
    const blob = await this._fetchBlob(source);
    const bitmap = await createImageBitmap(blob);
    let width = bitmap.width;
    let height = bitmap.height;
    console.log(`[ImageModel] downloadImageAsGrayscalePng original bitmap dimensions: ${width}x${height}`);

    // Use target dimensions if provided
    if (targetWidth && targetHeight) {
      width = targetWidth;
      height = targetHeight;
      console.log(`[ImageModel] downloadImageAsGrayscalePng resizing to target dimensions: ${width}x${height}`);
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
    // Enable smoothing to avoid pixelation when scaling
    try {
      // @ts-ignore
      ctx.imageSmoothingEnabled = true;
      // @ts-ignore
      ctx.imageSmoothingQuality = 'high';
    } catch (e) {
      // Ignore if context doesn't expose these properties
    }

    // Apply rounded corners via clipping path
    const radius = 16;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    // Draw image to fit the target dimensions (with smoothing)
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const grayscaleData = new Uint8Array(width * height);

    // Extract luminance with gamma adjustment into a high-precision buffer
    const luminanceData = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      // Standard grayscale formula
      let luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      // User preference: the darker the better (gamma < 1)
      const gamma = 0.5;
      luminanceData[i] = 255 * Math.pow(luminance / 255, 1 / gamma);
    }

    // Apply 16-level (4-bit) Floyd-Steinberg dithering for smooth gradients
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldPixel = luminanceData[i];

        // Quantize to 16 levels (15 steps: 255 / 15 = 17)
        const newPixel = Math.max(0, Math.min(255, Math.round(oldPixel / 17) * 17));
        grayscaleData[i] = newPixel;

        const quantError = oldPixel - newPixel;

        // Diffuse the error to neighboring pixels (right, bottom-left, bottom, bottom-right)
        if (x + 1 < width) {
          luminanceData[i + 1] += quantError * 7 / 16;
        }
        if (y + 1 < height) {
          if (x - 1 >= 0) {
            luminanceData[(y + 1) * width + (x - 1)] += quantError * 3 / 16;
          }
          luminanceData[(y + 1) * width + x] += quantError * 5 / 16;
          if (x + 1 < width) {
            luminanceData[(y + 1) * width + (x + 1)] += quantError * 1 / 16;
          }
        }
      }
    }

    const result = encodeGrayscalePng(width, height, grayscaleData);
    return result;
  }
}

const imageModel = new ImageModel();
export const downloadImage = imageModel.downloadImage.bind(imageModel);
export const downloadImageAsBase64 = imageModel.downloadImageAsBase64.bind(imageModel);
export const downloadImageAsGrayscalePng = imageModel.downloadImageAsGrayscalePng.bind(imageModel);
export const uint8ArrayToBase64 = imageModel.uint8ArrayToBase64.bind(imageModel);