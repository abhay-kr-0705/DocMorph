// utils/imageProcessor.js

class ImageProcessor {
    /**
     * Converts a File or Blob to an Image object
     * @param {Blob|File} file
     * @returns {Promise<HTMLImageElement>}
     */
    static blobToImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    /**
     * Resizes and compresses an image to meet target criteria.
     * @param {Blob|File} sourceFile The original image file
     * @param {Object} options Options for processing
     * @param {number} [options.maxWidth=1920] Maximum width
     * @param {number} [options.maxHeight=1920] Maximum height
     * @param {number} [options.maxSizeKB=null] Target max size in KB (e.g., 50 for <50KB signatures)
     * @param {string} [options.outputType='image/jpeg'] Output MIME type
     * @returns {Promise<File>} The processed File object
     */
    static async processImage(sourceFile, options = {}) {
        const {
            maxWidth = 1920,
            maxHeight = 1920,
            maxSizeKB = null,
            outputType = 'image/jpeg'
        } = options;

        const img = await this.blobToImage(sourceFile);
        
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw the image onto the canvas
        // If it's a PNG being converted to JPEG, fill white background first to avoid black transparency
        if (outputType === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        // If no strict size limit, just export at standard quality
        if (!maxSizeKB) {
            return new Promise(resolve => {
                canvas.toBlob(blob => {
                    resolve(new File([blob], 'processed_image' + (outputType === 'image/jpeg' ? '.jpg' : '.png'), { type: outputType }));
                }, outputType, 0.9);
            });
        }

        // If target size is specified, we need to iteratively find the right quality
        let minQ = 0.1;
        let maxQ = 1.0;
        let targetQ = 0.9; // start high
        let bestBlob = null;
        let iter = 0;
        const maxIter = 10;
        const targetBytes = maxSizeKB * 1024; // Convert KB to Bytes

        return new Promise((resolve) => {
            const attempt = (quality) => {
                canvas.toBlob((blob) => {
                    iter++;
                    if (!bestBlob || blob.size <= targetBytes) {
                        bestBlob = blob; // always keep the best one that fits
                    }

                    if (iter >= maxIter) {
                        // Max iterations reached, return best blob
                        return resolve(new File([bestBlob], 'compressed.jpg', { type: outputType }));
                    }

                    if (blob.size > targetBytes) {
                        // Too big, decrease quality
                        maxQ = quality;
                        targetQ = (minQ + maxQ) / 2;
                        attempt(targetQ);
                    } else if (blob.size < targetBytes * 0.8) { // If it's significantly smaller, we could try higher quality
                        // It's under limit, but maybe we can make it better
                        minQ = quality;
                        targetQ = (minQ + maxQ) / 2;
                        attempt(targetQ);
                    } else {
                        // Perfect, it's close enough underneath the limit
                        resolve(new File([blob], 'compressed.jpg', { type: outputType }));
                    }
                }, outputType, quality);
            };

            attempt(targetQ);
        });
    }
}

// Attach to window so it can be used globally
window.ImageProcessor = ImageProcessor;
