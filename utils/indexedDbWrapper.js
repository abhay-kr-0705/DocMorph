// utils/indexedDbWrapper.js

class DocMorphDB {
    constructor() {
        this.dbName = 'DocMorphVault';
        this.dbVersion = 2; // Upgraded to v2 for 'profiles'
        this.docStoreName = 'documents';
        this.profileStoreName = 'profiles';
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.docStoreName)) {
                    db.createObjectStore(this.docStoreName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.profileStoreName)) {
                    db.createObjectStore(this.profileStoreName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('DocMorph IndexedDB Error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async _getDb() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    }

    // --- ENCRYPTION (Module 8) ---
    async _deriveKey(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: encoder.encode('docmorph-salt'), iterations: 100000, hash: 'SHA-256' },
            keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
    }

    async encryptBlob(blob, password) {
        const key = await this._deriveKey(password);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await blob.arrayBuffer();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
        return { iv: Array.from(iv), data: encrypted };
    }

    async decryptBlob(encryptedObj, password) {
        const key = await this._deriveKey(password);
        const iv = new Uint8Array(encryptedObj.iv);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedObj.data);
        return new Blob([decrypted]);
    }

    // --- DOCUMENTS ---
    async saveDocument(doc, password = null) {
        const db = await this._getDb();
        if (password && doc.blob instanceof Blob) {
            doc.encrypted = await this.encryptBlob(doc.blob, password);
            delete doc.blob; // Don't store plain blob
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readwrite');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.put(doc);
            request.onsuccess = () => resolve(doc);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getDocument(id, password = null) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readonly');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.get(id);
            request.onsuccess = async () => {
                const doc = request.result;
                if (doc && doc.encrypted && password) {
                    try {
                        doc.blob = await this.decryptBlob(doc.encrypted, password);
                    } catch (e) {
                        console.error("Decryption failed", e);
                    }
                }
                resolve(doc);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllDocuments() {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readonly');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteDocument(id) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readwrite');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- PROFILES (Module 1) ---
    async saveProfile(profileData) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.profileStoreName], 'readwrite');
            const store = transaction.objectStore(this.profileStoreName);
            profileData.id = 'default_profile'; // Single profile for now
            const request = store.put(profileData);
            
            request.onsuccess = () => resolve(profileData);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getProfile() {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.profileStoreName], 'readonly');
            const store = transaction.objectStore(this.profileStoreName);
            const request = store.get('default_profile');
            
            request.onsuccess = () => resolve(request.result || {});
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Attach to global scope for Service Worker or Window
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.DocMorphDB = new DocMorphDB();
} else if (typeof window !== 'undefined') {
    window.DocMorphDB = new DocMorphDB();
}

