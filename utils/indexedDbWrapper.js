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

    // --- DOCUMENTS ---
    async saveDocument(doc) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readwrite');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.put(doc);
            
            request.onsuccess = () => resolve(doc);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getDocument(id) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.docStoreName], 'readonly');
            const store = transaction.objectStore(this.docStoreName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
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
