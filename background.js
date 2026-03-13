// background.js
// DocMorph Service Worker

importScripts('utils/indexedDbWrapper.js');

const db = self.DocMorphDB;

// Initialize DB explicitly in background
db.init().then(() => {
    console.log("[DocMorph] Background DB Initialized");
}).catch(err => {
    console.error("[DocMorph] Background DB Init Failed:", err);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('DocMorph extension installed successfully.');
});

// Service Workers do NOT have FileReader.
// Use Response + arrayBuffer to convert Blob -> Base64 data URL.
async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const mime = blob.type || 'application/octet-stream';
    return `data:${mime};base64,${base64}`;
}

// Handle messages from Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === "GET_ALL_DOCS") {
        db.getAllDocuments().then(async (docs) => {
            const serializableDocs = [];
            for (const doc of docs) {
                let b64 = null;
                if (doc.blob) {
                    try {
                        b64 = await blobToBase64(doc.blob);
                    } catch(e) {
                        console.error("[DocMorph] Blob conversion error for doc:", doc.name, e);
                    }
                }
                serializableDocs.push({ ...doc, blobData: b64, blob: undefined });
            }
            sendResponse({ success: true, docs: serializableDocs });
        }).catch(err => {
            console.error("[DocMorph] GET_ALL_DOCS error:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === "GET_PROFILE") {
        db.getProfile().then(profile => {
            sendResponse({ success: true, profile: profile });
        }).catch(err => {
            console.error("[DocMorph] GET_PROFILE error:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true; 
    }

    if (request.action === "SAVE_PROFILE") {
        db.saveProfile(request.profileData).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            console.error("[DocMorph] SAVE_PROFILE error:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (request.action === "SAVE_DOC") {
        // Save a document from content script (used for restore)
        const docData = request.doc;
        // Reconstruct blob from base64 if needed
        if (docData.blobData && !docData.blob) {
            fetch(docData.blobData).then(r => r.blob()).then(blob => {
                docData.blob = blob;
                docData.size = blob.size;
                delete docData.blobData;
                return db.saveDocument(docData);
            }).then(() => {
                sendResponse({ success: true });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        } else {
            db.saveDocument(docData).then(() => {
                sendResponse({ success: true });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        }
        return true;
    }
});