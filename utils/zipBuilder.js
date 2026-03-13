// utils/zipBuilder.js
// Module 5: Lightweight ZIP file builder — zero dependencies
// Implements ZIP format (PKZIP) using STORE method (no compression needed since images are already compressed)

class ZipBuilder {
    constructor() {
        this.files = [];
    }

    /**
     * Add a file to the ZIP
     * @param {string} name - filename inside the zip
     * @param {Uint8Array|ArrayBuffer|Blob} data
     */
    async addFile(name, data) {
        let bytes;
        if (data instanceof Blob) {
            const buf = await data.arrayBuffer();
            bytes = new Uint8Array(buf);
        } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
        } else {
            bytes = data;
        }
        this.files.push({ name, data: bytes });
    }

    /**
     * Generate the ZIP as a Blob
     * @returns {Blob}
     */
    generate() {
        const encoder = new TextEncoder();
        const parts = [];
        const centralDir = [];
        let offset = 0;

        for (const file of this.files) {
            const nameBytes = encoder.encode(file.name);
            const crc = this._crc32(file.data);

            // Local file header (30 bytes + name + data)
            const localHeader = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(localHeader.buffer);

            lv.setUint32(0, 0x04034b50, true);  // local file header signature
            lv.setUint16(4, 20, true);            // version needed to extract
            lv.setUint16(6, 0, true);             // general purpose bit flag
            lv.setUint16(8, 0, true);             // compression method: STORE
            lv.setUint16(10, 0, true);            // last mod time
            lv.setUint16(12, 0, true);            // last mod date
            lv.setUint32(14, crc, true);          // crc-32
            lv.setUint32(18, file.data.length, true); // compressed size
            lv.setUint32(22, file.data.length, true); // uncompressed size
            lv.setUint16(26, nameBytes.length, true); // file name length
            lv.setUint16(28, 0, true);            // extra field length

            localHeader.set(nameBytes, 30);

            // Central directory header
            const cdHeader = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(cdHeader.buffer);

            cv.setUint32(0, 0x02014b50, true);   // central directory header
            cv.setUint16(4, 20, true);            // version made by
            cv.setUint16(6, 20, true);            // version needed
            cv.setUint16(8, 0, true);             // flags
            cv.setUint16(10, 0, true);            // compression method: STORE
            cv.setUint16(12, 0, true);            // last mod time
            cv.setUint16(14, 0, true);            // last mod date
            cv.setUint32(16, crc, true);          // crc-32
            cv.setUint32(20, file.data.length, true); // compressed size
            cv.setUint32(24, file.data.length, true); // uncompressed size
            cv.setUint16(28, nameBytes.length, true); // file name length
            cv.setUint16(30, 0, true);            // extra field length
            cv.setUint16(32, 0, true);            // file comment length
            cv.setUint16(34, 0, true);            // disk number start
            cv.setUint16(36, 0, true);            // internal file attrs
            cv.setUint32(38, 0, true);            // external file attrs
            cv.setUint32(42, offset, true);       // relative offset of local header
            cdHeader.set(nameBytes, 46);

            centralDir.push(cdHeader);

            parts.push(localHeader);
            parts.push(file.data);

            offset += localHeader.length + file.data.length;
        }

        // Write central directory
        const cdOffset = offset;
        let cdSize = 0;
        for (const cd of centralDir) {
            parts.push(cd);
            cdSize += cd.length;
        }

        // End of central directory record (22 bytes)
        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);          // end of central dir signature
        ev.setUint16(4, 0, true);                    // disk number
        ev.setUint16(6, 0, true);                    // disk with cd start
        ev.setUint16(8, this.files.length, true);    // entries on this disk
        ev.setUint16(10, this.files.length, true);   // total entries
        ev.setUint32(12, cdSize, true);              // central dir size
        ev.setUint32(16, cdOffset, true);            // cd offset
        ev.setUint16(20, 0, true);                   // comment length

        parts.push(eocd);

        return new Blob(parts, { type: 'application/zip' });
    }

    // CRC-32 calculation
    _crc32(data) {
        let table = ZipBuilder._crc32Table;
        if (!table) {
            table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let k = 0; k < 8; k++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c;
            }
            ZipBuilder._crc32Table = table;
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
}

if (typeof window !== 'undefined') window.ZipBuilder = ZipBuilder;

