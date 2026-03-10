// utils/imageProcessor.js
// Module 3: Enhanced Document Preparation & Processing

class ImageProcessor {
    /**
     * Convert a Blob/File to an Image element
     */
    static blobToImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image file.")); };
            img.src = url;
        });
    }

    /**
     * Core image processing: resize, crop to exact dimensions, and compress to target KB.
     * @param {Blob|File} sourceFile
     * @param {Object} opts
     * @param {number} [opts.maxWidth=1920]
     * @param {number} [opts.maxHeight=1920]
     * @param {number} [opts.exactWidth]  - If set, output is cropped/padded to exact width
     * @param {number} [opts.exactHeight] - If set, output is cropped/padded to exact height
     * @param {number} [opts.maxSizeKB]
     * @param {string} [opts.outputType='image/jpeg']
     * @param {string} [opts.bgColor='#FFFFFF'] - Background fill color
     * @returns {Promise<File>}
     */
    static async processImage(sourceFile, opts = {}) {
        const {
            maxWidth = 1920,
            maxHeight = 1920,
            exactWidth = null,
            exactHeight = null,
            maxSizeKB = null,
            outputType = 'image/jpeg',
            bgColor = '#FFFFFF'
        } = opts;

        const img = await this.blobToImage(sourceFile);
        
        let targetW, targetH;

        if (exactWidth && exactHeight) {
            // Exact dimensions: crop-to-fill (center crop)
            targetW = exactWidth;
            targetH = exactHeight;
        } else {
            // Scale to fit within max bounds
            targetW = img.width;
            targetH = img.height;
            if (targetW > maxWidth || targetH > maxHeight) {
                const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
                targetW = Math.round(targetW * ratio);
                targetH = Math.round(targetH * ratio);
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        // Fill background (important for JPEG transparency)
        if (outputType === 'image/jpeg') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, targetW, targetH);
        }

        if (exactWidth && exactHeight) {
            // Center-crop: fill the canvas by covering the entire area
            const scale = Math.max(targetW / img.width, targetH / img.height);
            const scaledW = img.width * scale;
            const scaledH = img.height * scale;
            const offsetX = (targetW - scaledW) / 2;
            const offsetY = (targetH - scaledH) / 2;
            ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
        } else {
            ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        // Export without size constraint
        if (!maxSizeKB) {
            return this._canvasToFile(canvas, outputType, 0.92);
        }

        // Binary search for target file size
        return this._compressToTargetKB(canvas, outputType, maxSizeKB);
    }

    /**
     * Convert an image to a PDF (single page, A4 or custom).
     * Returns a Blob of the PDF.
     */
    static async imageToPDF(imageFile, options = {}) {
        const { pageWidth = 595, pageHeight = 842 } = options; // A4 in points (72dpi)
        const img = await this.blobToImage(imageFile);

        // Scale image to fit page with margins
        const margin = 40;
        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2;
        const scale = Math.min(availW / img.width, availH / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        // Draw image onto canvas at correct size
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        // Get JPEG data
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpegBinary = atob(jpegDataUrl.split(',')[1]);
        const jpegBytes = new Uint8Array(jpegBinary.length);
        for (let i = 0; i < jpegBinary.length; i++) {
            jpegBytes[i] = jpegBinary.charCodeAt(i);
        }

        // Build a minimal valid PDF
        const imgXOffset = margin + (availW - w) / 2;
        const imgYOffset = margin + (availH - h) / 2;

        const pdf = this._buildMinimalPDF(pageWidth, pageHeight, jpegBytes, w, h, imgXOffset, imgYOffset);
        return new Blob([pdf], { type: 'application/pdf' });
    }

    /**
     * Batch process multiple files with the same settings.
     * Returns an array of {name, blob} objects.
     */
    static async batchProcess(files, opts = {}) {
        const results = [];
        for (const file of files) {
            try {
                if (file.type.startsWith('image/')) {
                    const processed = await this.processImage(file, opts);
                    results.push({ name: file.name, blob: processed, success: true });
                } else {
                    // Non-image files pass through
                    results.push({ name: file.name, blob: file, success: true });
                }
            } catch (err) {
                results.push({ name: file.name, blob: null, success: false, error: err.message });
            }
        }
        return results;
    }

    // --- Internal Helpers ---

    static _canvasToFile(canvas, type, quality) {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                const ext = type === 'image/png' ? '.png' : '.jpg';
                resolve(new File([blob], `processed${ext}`, { type }));
            }, type, quality);
        });
    }

    static _compressToTargetKB(canvas, type, maxSizeKB) {
        const targetBytes = maxSizeKB * 1024;
        return new Promise(resolve => {
            let minQ = 0.05, maxQ = 1.0;
            let bestBlob = null;
            let iter = 0;

            const attempt = (quality) => {
                canvas.toBlob((blob) => {
                    iter++;
                    if (blob.size <= targetBytes) bestBlob = blob;

                    if (iter >= 14 || (blob.size <= targetBytes && blob.size > targetBytes * 0.7)) {
                        const final = bestBlob || blob;
                        resolve(new File([final], 'compressed.jpg', { type }));
                        return;
                    }

                    if (blob.size > targetBytes) {
                        maxQ = quality;
                    } else {
                        minQ = quality;
                    }
                    attempt((minQ + maxQ) / 2);
                }, type, quality);
            };

            attempt(0.85);
        });
    }

    /**
     * Builds a minimal but valid PDF containing a single JPEG image.
     * No external library required.
     */
    static _buildMinimalPDF(pageW, pageH, jpegBytes, imgW, imgH, xOff, yOff) {
        const encoder = new TextEncoder();
        const parts = [];
        const offsets = [];
        let pos = 0;

        function add(str) {
            const data = encoder.encode(str);
            parts.push(data);
            pos += data.length;
            return data;
        }
        function addBin(arr) {
            parts.push(arr);
            pos += arr.length;
        }

        // Header
        add('%PDF-1.4\n');

        // Object 1: Catalog
        offsets[1] = pos;
        add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

        // Object 2: Pages
        offsets[2] = pos;
        add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

        // Object 3: Page
        offsets[3] = pos;
        add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`);

        // Object 4: Content stream
        const content = `q ${imgW} 0 0 ${imgH} ${xOff} ${pageH - yOff - imgH} cm /Im0 Do Q`;
        offsets[4] = pos;
        add(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

        // Object 5: Image XObject
        offsets[5] = pos;
        add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
        addBin(jpegBytes);
        add('\nendstream\nendobj\n');

        // XRef table
        const xrefPos = pos;
        add('xref\n');
        add(`0 6\n`);
        add('0000000000 65535 f \n');
        for (let i = 1; i <= 5; i++) {
            add(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
        }

        add('trailer\n<< /Size 6 /Root 1 0 R >>\n');
        add('startxref\n');
        add(`${xrefPos}\n`);
        add('%%EOF\n');

        // Combine
        const total = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        for (const part of parts) {
            result.set(part, offset);
            offset += part.length;
        }
        return result;
    }
}

// Expose globally
if (typeof window !== 'undefined') window.ImageProcessor = ImageProcessor;
