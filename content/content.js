// content.js
// DocMorph Content Script — fully self-contained, all DB via chrome.runtime messaging

const shieldIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0zm0 66.8V444.8C394 378 431.1 230.1 432 141.4L256 66.8l0 0z"/></svg>`;
const closeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

class DocMorphContent {
    constructor() {
        this.activeInput = null;
        this.selectedDoc = null;
        this.allDocsCache = [];
        this.init();
    }

    init() {
        this.createOverlay();
        this.scanForFileInputs();
        this.scanForTextForms();
        
        const observer = new MutationObserver(() => {
            this.scanForFileInputs();
            this.scanForTextForms();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        console.log("[DocMorph] Content script initialized. All DB routed via background.");
    }

    // ========================================
    //  FILE INPUT INJECTION (Document Vault)
    // ========================================

    scanForFileInputs() {
        const fileInputs = document.querySelectorAll('input[type="file"]:not([data-docmorph-injected])');
        fileInputs.forEach(input => {
            input.setAttribute('data-docmorph-injected', 'true');
            this.injectFileButton(input);
        });
    }

    injectFileButton(input) {
        const wrapper = document.createElement('div');
        wrapper.className = 'docmorph-inject-wrapper';
        if (input.parentNode) {
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'docmorph-btn';
        btn.innerHTML = `${shieldIcon} Fill from Vault`;
        btn.title = "Use DocMorph to auto-fill this document";
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.activeInput = input;
            this.openVaultOverlay();
        });

        wrapper.appendChild(btn);
    }

    // ========================================
    //  BACKGROUND MESSAGING HELPERS
    // ========================================

    requestDocsFromBackground() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "GET_ALL_DOCS" }, async (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[DocMorph] Messaging error:", chrome.runtime.lastError.message);
                    return resolve([]);
                }
                if (response && response.success) {
                    // Reconstruct blobs from base64 data URLs
                    const reconstructed = [];
                    for (const doc of response.docs) {
                        if (doc.blobData) {
                            try {
                                const res = await fetch(doc.blobData);
                                doc.blob = await res.blob();
                            } catch (e) {
                                console.warn("[DocMorph] Could not reconstruct blob for:", doc.name);
                                doc.blob = null;
                            }
                        }
                        reconstructed.push(doc);
                    }
                    resolve(reconstructed);
                } else {
                    console.error("[DocMorph] Failed to get docs from background", response?.error);
                    resolve([]);
                }
            });
        });
    }

    getProfileFromBackground() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[DocMorph] Messaging error:", chrome.runtime.lastError.message);
                    return resolve({});
                }
                if (response && response.success) {
                    resolve(response.profile || {});
                } else {
                    resolve({});
                }
            });
        });
    }

    // ========================================
    //  VAULT OVERLAY (for file inputs)
    // ========================================

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'docmorph-overlay';
        this.overlay.innerHTML = `
            <div class="docmorph-modal">
                <div class="docmorph-header">
                    <h2>DocMorph Vault</h2>
                    <button class="docmorph-close" id="dmCloseBtn">${closeIcon}</button>
                </div>
                <div class="docmorph-filters">
                    <select id="dmProfileFilter" class="docmorph-filter-select">
                        <option value="All">All Profiles</option>
                        <option value="Self">Self</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="docmorph-body" id="dmDocList">
                    <div class="docmorph-empty">Loading...</div>
                </div>
                <div class="docmorph-footer">
                    <div class="docmorph-options-title">Detected Requirements (editable)</div>
                    <div class="docmorph-target-size" style="display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom: 8px;">
                        <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;">Max KB: <input type="number" id="dmMaxSize" style="width:50px;font-size:0.75rem;padding:2px;"/></label>
                        <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;">W: <input type="number" id="dmTargetW" style="width:50px;font-size:0.75rem;padding:2px;"/></label>
                        <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;">H: <input type="number" id="dmTargetH" style="width:50px;font-size:0.75rem;padding:2px;"/></label>
                    </div>
                    <button class="docmorph-fill-btn" id="dmFillBtn" disabled>Select a document</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('#dmCloseBtn').addEventListener('click', () => this.closeVaultOverlay());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.closeVaultOverlay();
        });
        this.overlay.querySelector('#dmFillBtn').addEventListener('click', () => this.processAndFill());
        this.overlay.querySelector('#dmProfileFilter').addEventListener('change', () => this.renderList());
    }

    async openVaultOverlay() {
        this.overlay.classList.add('active');
        this.selectedDoc = null;
        
        const dmFillBtn = this.overlay.querySelector('#dmFillBtn');
        dmFillBtn.disabled = true;
        dmFillBtn.textContent = 'Select a document';

        this.guessSizeRequirement();

        try {
            this.allDocsCache = await this.requestDocsFromBackground();
            this.renderList();
        } catch (err) {
            console.error("[DocMorph]", err);
            this.overlay.querySelector('#dmDocList').innerHTML = `<div class="docmorph-empty">Error loading documents.</div>`;
        }
    }

    renderList() {
        const listEl = this.overlay.querySelector('#dmDocList');
        const filterVal = this.overlay.querySelector('#dmProfileFilter').value;
        
        let docs = this.allDocsCache;
        if (filterVal !== 'All') {
            docs = docs.filter(d => (d.profile || 'Self') === filterVal);
        }

        if (docs.length === 0) {
            const msg = this.allDocsCache.length === 0
                ? 'Your vault is empty. Add documents via the DocMorph popup.'
                : 'No documents found for this profile.';
            listEl.innerHTML = `<div class="docmorph-empty">${msg}</div>`;
            return;
        }

        listEl.innerHTML = '<div class="docmorph-list"></div>';
        const listContainer = listEl.querySelector('.docmorph-list');

        docs.sort((a, b) => b.addedAt - a.addedAt).forEach(doc => {
            const item = document.createElement('div');
            item.className = 'docmorph-item';
            
            const isImage = doc.type && doc.type.startsWith('image/');
            const profileTag = doc.profile || 'Self';
            
            let previewHtml = `<div class="docmorph-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>`;
            
            if (isImage && doc.blob) {
                const url = URL.createObjectURL(doc.blob);
                previewHtml = `<div class="docmorph-item-icon"><img src="${url}"></div>`;
            }

            item.innerHTML = `
                ${previewHtml}
                <div class="docmorph-item-info">
                    <p class="docmorph-item-name" title="${this.escapeHtml(doc.name)}">${this.escapeHtml(doc.name)}</p>
                    <p class="docmorph-item-meta">
                        <span class="docmorph-item-tag">${this.escapeHtml(profileTag)}</span>
                        <span>• ${this.formatBytes(doc.size)}</span>
                    </p>
                </div>
            `;

            item.addEventListener('click', () => {
                this.overlay.querySelectorAll('.docmorph-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedDoc = doc;
                const dmFillBtn = this.overlay.querySelector('#dmFillBtn');
                dmFillBtn.disabled = false;
                dmFillBtn.textContent = 'Fill Form';
            });

            listContainer.appendChild(item);
        });
    }

    closeVaultOverlay() {
        this.overlay.classList.remove('active');
    }

    guessSizeRequirement() {
        const sizeInput = this.overlay.querySelector('#dmMaxSize');
        const wInput = this.overlay.querySelector('#dmTargetW');
        const hInput = this.overlay.querySelector('#dmTargetH');
        sizeInput.value = ''; wInput.value = ''; hInput.value = '';
        if (!this.activeInput) return;
        
        // Scan parent and label text for requirements
        const parentText = (this.activeInput.closest('div, td, li, section, form')?.textContent || '').toLowerCase();
        
        // 1. Match KB/MB limits
        const sizeMatch = parentText.match(/(?:max(?:imum)?|under|less than|upto|up to|<)[^0-9]{0,10}([0-9]{2,4})\s*(kb|mb)/i);
        if (sizeMatch) {
            let num = parseInt(sizeMatch[1]);
            if (sizeMatch[2].toLowerCase() === 'mb') num = num * 1024;
            sizeInput.value = num;
        }

        // 2. Match Dimensions (e.g. 200x230, 200 x 230, 200px * 230px, width 200 height 230)
        let dimMatch = parentText.match(/(\d{2,4})\s*px\s*[xX*]\s*(\d{2,4})\s*px/);
        if (!dimMatch) dimMatch = parentText.match(/(\d{2,4})\s*[xX*]\s*(\d{2,4})/);
        if (!dimMatch) dimMatch = parentText.match(/width\s*(\d{2,4}).*?height\s*(\d{2,4})/);
        
        if (dimMatch && parseInt(dimMatch[1]) > 10 && parseInt(dimMatch[2]) > 10) {
            wInput.value = parseInt(dimMatch[1]);
            hInput.value = parseInt(dimMatch[2]);
        }
    }

    async processAndFill() {
        if (!this.selectedDoc || !this.activeInput) return;

        const fillBtn = this.overlay.querySelector('#dmFillBtn');
        fillBtn.disabled = true;
        fillBtn.innerHTML = `<span class="docmorph-spinner"></span> Processing...`;

        try {
            let finalBlob = this.selectedDoc.blob;

            if (!finalBlob) {
                throw new Error("Document blob is missing. Try re-saving it in the vault.");
            }

            // Client-side image compression using canvas
            const targetKB = parseInt(this.overlay.querySelector('#dmMaxSize').value);
            const targetW = parseInt(this.overlay.querySelector('#dmTargetW').value);
            const targetH = parseInt(this.overlay.querySelector('#dmTargetH').value);

            if (this.selectedDoc.type.startsWith('image/')) {
                if ((targetKB && targetKB > 0) || (targetW > 0 && targetH > 0)) {
                    finalBlob = await this.processImageLocally(finalBlob, targetKB, targetW, targetH);
                }
            }

            // Populate the file input
            const dataTransfer = new DataTransfer();
            const ext = finalBlob.type === 'application/pdf' ? '.pdf' : '.jpg';
            const baseName = this.selectedDoc.originalName ? this.selectedDoc.originalName.split('.')[0] : 'document';
            const fileName = `${baseName}_docmorph${ext}`;
            
            const fileObj = new File([finalBlob], fileName, { type: finalBlob.type });
            dataTransfer.items.add(fileObj);
            
            this.activeInput.files = dataTransfer.files;
            
            // Fire events for React/Vue/Angular
            this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));

            this.closeVaultOverlay();
        } catch (error) {
            console.error('[DocMorph] Processing Error:', error);
            alert('DocMorph Error: ' + error.message);
            fillBtn.textContent = 'Error — try again';
            fillBtn.disabled = false;
        }
    }

    // In-page Canvas-based compression & cropping
    processImageLocally(blob, maxSizeKB, exactW, exactH) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                
                let sWidth = img.width;
                let sHeight = img.height;
                let sX = 0, sY = 0;
                let dWidth = sWidth, dHeight = sHeight;

                // 1. Handle exact dimension requests with center-cropping
                if (exactW && exactH) {
                    dWidth = exactW;
                    dHeight = exactH;
                    const srcRatio = sWidth / sHeight;
                    const dstRatio = dWidth / dHeight;

                    if (srcRatio > dstRatio) {
                        const newWidth = sHeight * dstRatio;
                        sX = (sWidth - newWidth) / 2;
                        sWidth = newWidth;
                    } else {
                        const newHeight = sWidth / dstRatio;
                        sY = (sHeight - newHeight) / 2;
                        sHeight = newHeight;
                    }
                } else {
                    // Safe scale-down if no exact dimensions given
                    const MAX_DIM = 1920;
                    if (sWidth > MAX_DIM || sHeight > MAX_DIM) {
                        const ratio = Math.min(MAX_DIM / sWidth, MAX_DIM / sHeight);
                        dWidth = Math.round(sWidth * ratio);
                        dHeight = Math.round(sHeight * ratio);
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = dWidth;
                canvas.height = dHeight;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, dWidth, dHeight);
                ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, dWidth, dHeight);

                if (!maxSizeKB && !exactW) {
                    resolve(blob);
                    return;
                }

                const targetBytes = maxSizeKB ? maxSizeKB * 1024 : 500 * 1024;
                let minQ = 0.05, maxQ = 1.0;
                let bestBlob = null;
                let iter = 0;

                const attempt = (quality) => {
                    canvas.toBlob((result) => {
                        iter++;
                        if (result.size <= targetBytes || !maxSizeKB) {
                            bestBlob = result;
                        }
                        
                        // If no KB constraint but we needed dimension resize, just return high quality once resolved
                        if (!maxSizeKB && bestBlob) {
                            resolve(bestBlob);
                            return;
                        }
                        
                        if (iter >= 12 || (result.size <= targetBytes && result.size > targetBytes * 0.7)) {
                            resolve(bestBlob || result);
                            return;
                        }

                        if (result.size > targetBytes) {
                            maxQ = quality;
                        } else {
                            minQ = quality;
                        }

                        attempt((minQ + maxQ) / 2);
                    }, 'image/jpeg', quality);
                };

                attempt(maxSizeKB ? 0.85 : 0.95);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for processing."));
            };
            img.src = url;
        });
    }

    // ========================================
    //  TEXT FORM AUTOFILL (Module 2)
    // ========================================

    scanForTextForms() {
        const textInputs = document.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="tel"], input[type="date"], input[type="number"], input:not([type]), textarea'
        );
        if (textInputs.length > 2 && !document.getElementById('dmAutofillFloatingBtn')) {
            this.injectAutofillFloatingButton();
        }
    }

    injectAutofillFloatingButton() {
        const fab = document.createElement('button');
        fab.id = 'dmAutofillFloatingBtn';
        fab.className = 'docmorph-fab';
        fab.innerHTML = `${shieldIcon} Autofill`;
        fab.title = "DocMorph: Fill the form with your stored Profile";
        
        fab.addEventListener('click', async () => {
            fab.disabled = true;
            fab.innerHTML = `<span class="docmorph-spinner"></span> Filling...`;
            await this.executeAutofill();
            setTimeout(() => {
                fab.disabled = false;
                fab.innerHTML = `${shieldIcon} Autofill`;
            }, 1500);
        });

        document.body.appendChild(fab);
    }

    // Get the closest visible label text for an input
    getLabelText(input) {
        // 1. Check <label for="id">
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent.toLowerCase().trim();
        }
        // 2. Check parent <label>
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.textContent.toLowerCase().trim();
        // 3. Check preceding sibling/text
        const prev = input.previousElementSibling;
        if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV')) {
            return prev.textContent.toLowerCase().trim();
        }
        return '';
    }

    async executeAutofill() {
        const profile = await this.getProfileFromBackground();
        if (!profile || Object.keys(profile).length <= 1) { // 'id' key always exists
            alert("DocMorph: Your profile is empty. Please fill it via the extension popup first.");
            return;
        }

        // Extended keyword mapping
        const fieldMap = [
            { key: 'name',       keywords: ['name', 'fullname', 'full name', 'first_name', 'firstname', 'applicant', 'candidate name', 'your name'] },
            { key: 'email',      keywords: ['email', 'e-mail', 'mail'] },
            { key: 'phone',      keywords: ['phone', 'mobile', 'cell', 'tel', 'contact', 'whatsapp'] },
            { key: 'dob',        keywords: ['dob', 'date of birth', 'dateofbirth', 'birthdate', 'bday', 'birth date', 'birthday'] },
            { key: 'address',    keywords: ['address', 'addr', 'street', 'residential', 'correspondence', 'permanent address'] },
            { key: 'fatherName', keywords: ['father', 'guardian', 'parent name', "father's name", 'fathername'] },
            { key: 'category',   keywords: ['category', 'caste', 'reservation', 'gen/obc/sc/st'] },
            { key: 'pincode',    keywords: ['pin', 'pincode', 'zip', 'postal'] },
            { key: 'state',      keywords: ['state', 'province'] },
            { key: 'gender',     keywords: ['gender', 'sex'] },
        ];

        const inputs = document.querySelectorAll('input, select, textarea');
        let totalFilled = 0;

        inputs.forEach(input => {
            if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'file') return;
            
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const labelText = this.getLabelText(input);

            for (const { key, keywords } of fieldMap) {
                const pValue = profile[key];
                if (!pValue) continue;

                const matches = keywords.some(tag =>
                    name.includes(tag) || id.includes(tag) || placeholder.includes(tag) || labelText.includes(tag)
                );

                if (matches) {
                    // Only fill if empty or user hasn't typed yet
                    if (!input.value || input.value.trim() === '') {
                        input.value = pValue;
                        input.style.backgroundColor = '#eef2ff';
                        input.style.borderColor = '#4f46e5';
                        input.style.transition = 'all 0.3s';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        totalFilled++;
                    }
                    break; // Only fill with the first matching key
                }
            }
        });

        if (totalFilled > 0) {
            console.log(`[DocMorph] Autofilled ${totalFilled} fields.`);
        } else {
            alert("DocMorph: No matching fields found on this page.");
        }
    }

    // ========================================
    //  UTILITIES
    // ========================================

    formatBytes(bytes) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${['B', 'KB', 'MB'][i]}`;
    }

    escapeHtml(unsafe) {
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DocMorphContent());
} else {
    new DocMorphContent();
}
