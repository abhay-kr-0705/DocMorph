// popup/script.js
// DocMorph Popup — Full Feature Suite

document.addEventListener('DOMContentLoaded', async () => {
    const errorOverlay = document.getElementById('errorOverlay');
    const appContainer = document.getElementById('appContainer');
    const pinLockScreen = document.getElementById('pinLockScreen');
    const db = window.DocMorphDB;

    // ============================
    //  PIN LOCK (Module 8)
    // ============================
    const pinData = await chrome.storage.local.get(['docmorph_pin']);
    const storedPin = pinData.docmorph_pin || null;

    if (storedPin) {
        pinLockScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        initPinLockUI(storedPin);
    }

    function initPinLockUI(correctPin) {
        const digits = pinLockScreen.querySelectorAll('.pin-digit');
        const pinError = document.getElementById('pinError');
        const btnForgotPin = document.getElementById('btnForgotPin');

        digits[0].focus();

        digits.forEach((d, i) => {
            d.addEventListener('input', () => {
                if (d.value && i < 3) digits[i + 1].focus();
                const full = Array.from(digits).map(x => x.value).join('');
                if (full.length === 4) {
                    if (full === correctPin) {
                        pinLockScreen.style.display = 'none';
                        appContainer.style.display = 'flex';
                        startApp();
                    } else {
                        pinError.style.display = 'block';
                        digits.forEach(x => { x.value = ''; });
                        digits[0].focus();
                        setTimeout(() => pinError.style.display = 'none', 2000);
                    }
                }
            });
            d.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !d.value && i > 0) digits[i - 1].focus();
            });
        });

        btnForgotPin.addEventListener('click', async () => {
            if (confirm('This will remove the PIN lock. Your data will NOT be deleted. Continue?')) {
                await chrome.storage.local.remove('docmorph_pin');
                pinLockScreen.style.display = 'none';
                appContainer.style.display = 'flex';
                startApp();
            }
        });
    }

    if (!storedPin) startApp();

    async function startApp() {
        let vaultPassword = null; // Session password for encryption
        
        // --- ONBOARDING (Module 9) ---
        chrome.storage.local.get(['docmorph_onboarded'], (data) => {
            if (!data.docmorph_onboarded) {
                document.getElementById('onboardingOverlay').style.display = 'flex';
            }
        });
        document.getElementById('btnEndOnboarding').addEventListener('click', () => {
            document.getElementById('onboardingOverlay').style.display = 'none';
            chrome.storage.local.set({ docmorph_onboarded: true });
        });

        try {
            await db.init();
        } catch (err) {
            console.error("DocMorph DB Init Error:", err);
            errorOverlay.style.display = 'flex';
            return;
        }

        // ============================
        //  TAB SWITCHING
        // ============================
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');
                btn.classList.add('active');
                document.getElementById(`tab-${target}`).style.display = 'block';
                if (target === 'profile') loadProfile();
                if (target === 'kit') initKitTab();
                if (target === 'tools') initToolsTab();
            });
        });

        // ============================
        //  MODULE 7: OCR & SCAN
        // ============================
        const btnScanId = document.getElementById('btnScanId');
        const scanIdInput = document.getElementById('scanIdInput');
        const ocrStatus = document.getElementById('ocrStatus');

        btnScanId.addEventListener('click', () => scanIdInput.click());

        scanIdInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            ocrStatus.style.display = 'block';
            ocrStatus.className = 'ocr-status active';
            ocrStatus.textContent = '🔍 Initializing OCR Engine...';

            try {
                // Tesseract.js Local worker
                const worker = await Tesseract.createWorker('eng', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            ocrStatus.textContent = `📝 Scanning: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                });

                const { data: { text } } = await worker.recognize(file);
                await worker.terminate();

                const extracted = extractData(text);
                if (extracted.found) {
                    fillExtractedData(extracted.data);
                    ocrStatus.className = 'ocr-status success';
                    ocrStatus.textContent = `✅ Extracted: ${extracted.fields.join(', ')}`;
                } else {
                    ocrStatus.className = 'ocr-status warn';
                    ocrStatus.textContent = '⚠ No clear data found. Try a clearer image.';
                    console.log("OCR Raw Text:", text); // For debugging
                }

            } catch (err) {
                console.error("OCR Error:", err);
                ocrStatus.className = 'ocr-status error';
                ocrStatus.textContent = '❌ OCR failed. Is internet available?';
            }
            scanIdInput.value = '';
        });

        function extractData(text) {
            const data = {};
            const fields = [];
            let found = false;

            // 1. Aadhaar (12 digits, often 4-4-4)
            const aadhaarMatch = text.match(/\d{4}\s\d{4}\s\d{4}/) || text.match(/\d{12}/);
            if (aadhaarMatch) {
                data.aadhaar = aadhaarMatch[0].replace(/\s/g, '');
                // Note: We don't have an Aadhaar field in profile yet, but we could add it.
                found = true;
            }

            // 2. PAN (5 letters, 4 digits, 1 letter)
            const panMatch = text.match(/[A-Z]{5}\d{4}[A-Z]{1}/i);
            if (panMatch) {
                data.pan = panMatch[0].toUpperCase();
                found = true;
            }

            // 3. DOB (DD/MM/YYYY or DD-MM-YYYY)
            const dobMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
            if (dobMatch) {
                const [_, d, m, y] = dobMatch;
                data.dob = `${y}-${m}-${d}`; // HTML input date format
                fields.push('DOB');
                found = true;
            }

            // 4. Name (Heuristic: usually after "Name" or "DOB")
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('name') && lines[i+1]) {
                    data.name = lines[i+1].replace(/[^a-zA-Z\s]/g, '').trim();
                    fields.push('Name');
                    found = true;
                    break;
                }
            }

            // 5. Gender
            if (text.toLowerCase().includes('male') && !text.toLowerCase().includes('female')) {
                data.gender = 'Male';
                fields.push('Gender');
                found = true;
            } else if (text.toLowerCase().includes('female')) {
                data.gender = 'Female';
                fields.push('Gender');
                found = true;
            }

            return { found, data, fields };
        }

        function fillExtractedData(data) {
            if (data.name) pEl('name').value = data.name;
            if (data.dob) pEl('dob').value = data.dob;
            if (data.gender) pEl('gender').value = data.gender;
            // Aadhaar/PAN can be saved to address or future fields if needed
        }

        // ============================
        //  PROFILE MODULE + QUICK COPY
        // ============================
        const profileForm = document.getElementById('profileForm');
        const profileSaveMsg = document.getElementById('profileSaveMsg');
        const quickCopySection = document.getElementById('quickCopySection');
        const quickCopyGrid = document.getElementById('quickCopyGrid');
        const profileFields = ['name', 'dob', 'phone', 'email', 'fatherName', 'category', 'address', 'gender', 'state', 'pincode'];

        function pEl(f) { return document.getElementById(`p_${f}`); }

        async function loadProfile() {
            try {
                const p = await db.getProfile();
                if (p) {
                    profileFields.forEach(f => { const el = pEl(f); if (el) el.value = p[f] || ''; });
                    buildQuickCopy(p);
                }
            } catch (e) { console.error("Profile load error:", e); }
        }

        function buildQuickCopy(profile) {
            const items = [
                { label: 'Name', key: 'name' },
                { label: 'Phone', key: 'phone' },
                { label: 'Email', key: 'email' },
                { label: 'DOB', key: 'dob' },
                { label: 'Father', key: 'fatherName' },
                { label: 'Address', key: 'address' },
                { label: 'Pincode', key: 'pincode' },
                { label: 'State', key: 'state' }
            ].filter(i => profile[i.key]);

            if (items.length === 0) {
                quickCopySection.style.display = 'none';
                return;
            }

            quickCopySection.style.display = 'block';
            quickCopyGrid.innerHTML = '';

            items.forEach(({ label, key }) => {
                const chip = document.createElement('button');
                chip.className = 'quick-copy-chip';
                chip.innerHTML = `<span class="qc-label">${label}</span><span class="qc-value">${esc(profile[key])}</span>`;
                chip.title = `Click to copy: ${profile[key]}`;
                chip.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(profile[key]);
                        chip.classList.add('copied');
                        const origLabel = chip.querySelector('.qc-label').textContent;
                        chip.querySelector('.qc-label').textContent = '✓ Copied';
                        setTimeout(() => {
                            chip.classList.remove('copied');
                            chip.querySelector('.qc-label').textContent = origLabel;
                        }, 1200);
                    } catch (e) {
                        // Fallback for older browsers
                        const ta = document.createElement('textarea');
                        ta.value = profile[key];
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }
                });
                quickCopyGrid.appendChild(chip);
            });
        }

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { id: 'default_profile' };
            profileFields.forEach(f => {
                const el = pEl(f);
                data[f] = el ? (el.value || '').trim() : '';
            });
            data.dob = pEl('dob').value;

            const btn = document.getElementById('btnSaveProfile');
            btn.disabled = true; btn.textContent = 'Saving...';
            try {
                await db.saveProfile(data);
                profileSaveMsg.style.display = 'block';
                setTimeout(() => profileSaveMsg.style.display = 'none', 3000);
                buildQuickCopy(data);
            } catch (err) {
                alert('Failed to save profile.');
            } finally {
                btn.disabled = false; btn.textContent = 'Save Profile Locally';
            }
        });

        // ============================
        //  VAULT MODULE
        // ============================
        const fileInput = document.getElementById('fileInput');
        const fileDropArea = document.getElementById('fileDropArea');
        const previewArea = document.getElementById('previewArea');
        const imagePreview = document.getElementById('imagePreview');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const fileSizeDisplay = document.getElementById('fileSizeDisplay');
        const btnRemoveFile = document.getElementById('btnRemoveFile');
        const btnSave = document.getElementById('btnSave');
        const docNameInput = document.getElementById('docName');
        const docProfileSelect = document.getElementById('docProfile');
        const examPresetSelect = document.getElementById('examPreset');
        const docTypeGroup = document.getElementById('docTypeGroup');
        const docTypeSelect = document.getElementById('docType');
        const customDims = document.getElementById('customDims');
        const validationInfo = document.getElementById('validationInfo');
        const documentList = document.getElementById('documentList');
        const emptyState = document.getElementById('emptyState');
        const docCount = document.getElementById('docCount');
        const filterProfileSelect = document.getElementById('filterProfile');
        const storageText = document.getElementById('storageText');
        const btnBackup = document.getElementById('btnBackup');
        const btnRestore = document.getElementById('btnRestore');
        const restoreFileInput = document.getElementById('restoreFileInput');

        let currentFile = null;

        // Populate exam presets dropdown
        const presets = window.EXAM_PRESETS;
        for (const [key, val] of Object.entries(presets)) {
            const opt = document.createElement('option');
            opt.value = key; opt.textContent = val.name;
            examPresetSelect.appendChild(opt);
        }

        examPresetSelect.addEventListener('change', () => {
            const v = examPresetSelect.value;
            if (v === 'none') { docTypeGroup.style.display = 'none'; customDims.style.display = 'none'; validationInfo.style.display = 'none'; }
            else if (v === 'CUSTOM') { docTypeGroup.style.display = 'none'; customDims.style.display = 'block'; validationInfo.style.display = 'none'; }
            else { docTypeGroup.style.display = 'block'; customDims.style.display = 'none'; updateValidationInfo(); }
        });

        docTypeSelect.addEventListener('change', updateValidationInfo);

        function updateValidationInfo() {
            const preset = presets[examPresetSelect.value];
            if (!preset) return;
            const spec = preset[docTypeSelect.value];
            if (spec) {
                validationInfo.style.display = 'block'; validationInfo.className = 'validation-info info';
                validationInfo.innerHTML = `<strong>${preset.name}:</strong> ${spec.label}`;
            } else {
                validationInfo.style.display = 'block'; validationInfo.className = 'validation-info warn';
                validationInfo.textContent = `No ${docTypeSelect.value} spec for this exam.`;
            }
        }

        loadDocuments();

        // Drag & Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => fileDropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false));
        ['dragenter', 'dragover'].forEach(ev => fileDropArea.addEventListener(ev, () => fileDropArea.classList.add('dragover')));
        ['dragleave', 'drop'].forEach(ev => fileDropArea.addEventListener(ev, () => fileDropArea.classList.remove('dragover')));
        fileDropArea.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
        fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });

        btnRemoveFile.addEventListener('click', () => {
            currentFile = null; fileInput.value = '';
            fileDropArea.style.display = 'block'; previewArea.style.display = 'none';
            validationInfo.style.display = 'none'; updateSaveBtn();
        });
        docNameInput.addEventListener('input', updateSaveBtn);

        function handleFile(file) {
            currentFile = file;
            fileNameDisplay.textContent = file.name;
            fileSizeDisplay.textContent = formatBytes(file.size);
            if (file.type.startsWith('image/')) {
                imagePreview.src = URL.createObjectURL(file);
                imagePreview.style.display = 'block';
            } else { imagePreview.style.display = 'none'; }
            fileDropArea.style.display = 'none'; previewArea.style.display = 'flex';
            if (!docNameInput.value) {
                const base = file.name.split('.')[0];
                docNameInput.value = base.charAt(0).toUpperCase() + base.slice(1);
            }
            updateSaveBtn();
        }

        function updateSaveBtn() { btnSave.disabled = !(currentFile && docNameInput.value.trim()); }

        btnSave.addEventListener('click', async () => {
            if (!currentFile || !docNameInput.value.trim()) return;
            btnSave.disabled = true; btnSave.textContent = 'Processing...';
            try {
                let result = currentFile;
                const presetKey = examPresetSelect.value;
                if (currentFile.type.startsWith('image/')) {
                    if (presetKey !== 'none' && presetKey !== 'CUSTOM') {
                        const spec = presets[presetKey]?.[docTypeSelect.value];
                        if (spec) {
                            result = await window.ImageProcessor.processImage(currentFile, {
                                exactWidth: spec.width, exactHeight: spec.height,
                                maxSizeKB: spec.maxSizeKB, outputType: spec.format
                            });
                        }
                    } else if (presetKey === 'CUSTOM') {
                        const cw = parseInt(document.getElementById('customW').value);
                        const ch = parseInt(document.getElementById('customH').value);
                        const ckb = parseInt(document.getElementById('customKB').value);
                        const opts = { outputType: 'image/jpeg' };
                        if (cw && ch) { opts.exactWidth = cw; opts.exactHeight = ch; }
                        if (ckb) opts.maxSizeKB = ckb;
                        result = await window.ImageProcessor.processImage(currentFile, opts);
                    }
                }

                await db.saveDocument({
                    id: crypto.randomUUID(), name: docNameInput.value.trim(),
                    profile: docProfileSelect.value, category: document.getElementById('docCategory').value, type: result.type,
                    blob: result, originalName: currentFile.name,
                    size: result.size, expiry: document.getElementById('docExpiry').value || null,
                    addedAt: Date.now()
                }, vaultPassword);

                // Validation feedback
                if (presetKey !== 'none' && presetKey !== 'CUSTOM') {
                    const spec = presets[presetKey]?.[docTypeSelect.value];
                    if (spec) {
                        if (result.size <= spec.maxSizeKB * 1024) {
                            validationInfo.className = 'validation-info success';
                            validationInfo.innerHTML = `✓ Saved! ${formatBytes(result.size)} (limit: ${spec.maxSizeKB}KB)`;
                        } else {
                            validationInfo.className = 'validation-info warn';
                            validationInfo.innerHTML = `⚠ ${formatBytes(result.size)} — exceeds ${spec.maxSizeKB}KB. Try a smaller source.`;
                        }
                        validationInfo.style.display = 'block';
                    }
                }

                btnRemoveFile.click(); docNameInput.value = '';
                document.getElementById('docExpiry').value = '';
                examPresetSelect.value = 'none'; examPresetSelect.dispatchEvent(new Event('change'));
                loadDocuments();
            } catch (error) {
                console.error("Save Error:", error); alert('Error: ' + error.message);
            } finally { btnSave.textContent = 'Save to Vault'; updateSaveBtn(); }
        });

        const filterCategorySelect = document.getElementById('filterCategory');
        filterProfileSelect.addEventListener('change', loadDocuments);
        filterCategorySelect.addEventListener('change', loadDocuments);

        async function loadDocuments() {
            try {
                let docs = await db.getAllDocuments();
                // Update storage stats
                const totalSize = docs.reduce((s, d) => s + (d.size || 0), 0);
                storageText.textContent = `${docs.length} document${docs.length !== 1 ? 's' : ''} • ${formatBytes(totalSize)} used`;

                const fProfile = filterProfileSelect.value;
                if (fProfile !== 'All') docs = docs.filter(d => (d.profile || 'Self') === fProfile);
                
                const fCategory = filterCategorySelect.value;
                if (fCategory !== 'All') docs = docs.filter(d => (d.category || 'Other') === fCategory);

                documentList.innerHTML = ''; docCount.textContent = docs.length;
                if (!docs.length) { emptyState.style.display = 'block'; return; }
                emptyState.style.display = 'none';

                docs.sort((a, b) => b.addedAt - a.addedAt).forEach(async doc => {
                    // Pre-fetch decrypted blob if needed for preview
                    if (doc.encrypted && vaultPassword && !doc.blob) {
                         const fullDoc = await db.getDocument(doc.id, vaultPassword);
                         doc.blob = fullDoc.blob;
                    }
                    
                    const item = document.createElement('div');
                    item.className = 'doc-item';
                    const isImg = doc.type?.startsWith('image/');
                    const tag = doc.profile || 'Self';
                    const cat = doc.category || 'Other';
                    let preview = `<div class="doc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>`;
                    if (isImg && doc.blob) preview = `<img src="${URL.createObjectURL(doc.blob)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;min-width:40px;">`;

                    let expiryHtml = '';
                    if (doc.expiry) {
                        const daysLeft = Math.ceil((new Date(doc.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                        if (daysLeft < 0) {
                            expiryHtml = `<span style="color:#ef4444;font-size:0.65rem;font-weight:700;">[Expired]</span>`;
                        } else if (daysLeft <= 30) {
                            expiryHtml = `<span style="color:#d97706;font-size:0.65rem;font-weight:700;">[Exp in ${daysLeft}d]</span>`;
                        } else {
                            expiryHtml = `<span style="color:#10b981;font-size:0.65rem;">[Valid]</span>`;
                        }
                    }

                    item.innerHTML = `
                        <div class="doc-info">
                            ${preview}
                            <div class="doc-meta">
                                <span class="doc-name" title="${esc(doc.name)}">${esc(doc.name)} ${expiryHtml}</span>
                                <div style="display:flex;gap:6px;align-items:center;">
                                    <span class="doc-tags">${esc(cat)} • ${esc(tag)}</span>
                                    <span class="doc-size">• ${formatBytes(doc.size)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-icon" data-download="${doc.id}" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                            <button class="btn-icon del" data-id="${doc.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        </div>`;
                    documentList.appendChild(item);
                });

                documentList.querySelectorAll('[data-download]').forEach(btn => {
                    btn.addEventListener('click', async e => {
                        const doc = await db.getDocument(e.currentTarget.dataset.download, vaultPassword);
                        if (doc?.blob) {
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(doc.blob);
                            a.download = doc.originalName || doc.name; a.click();
                        } else if (doc?.encrypted && !vaultPassword) {
                            alert("Please enter vault password in Tools tab to access encrypted files.");
                        }
                    });
                });

                documentList.querySelectorAll('.del').forEach(btn => {
                    btn.addEventListener('click', async e => {
                        if (confirm('Delete this document?')) {
                            await db.deleteDocument(e.currentTarget.dataset.id);
                            loadDocuments();
                        }
                    });
                });
            } catch (err) { console.error("loadDocuments error:", err); }
        }

        // ============================
        //  BACKUP / RESTORE
        // ============================
        btnBackup.addEventListener('click', async () => {
            btnBackup.disabled = true;
            try {
                const docs = await db.getAllDocuments();
                if (!docs.length) { alert("Vault is empty."); btnBackup.disabled = false; return; }
                const exp = [];
                for (const d of docs) {
                    exp.push({ id: d.id, name: d.name, profile: d.profile, type: d.type,
                        originalName: d.originalName, size: d.size, addedAt: d.addedAt,
                        blobData: await blobToBase64(d.blob) });
                }
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([JSON.stringify(exp)], { type: 'application/json' }));
                a.download = `DocMorph_Backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
            } catch (e) { alert("Export failed."); } finally { btnBackup.disabled = false; }
        });

        btnRestore.addEventListener('click', () => restoreFileInput.click());
        restoreFileInput.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            btnRestore.disabled = true;
            try {
                const data = JSON.parse(await file.text());
                if (!Array.isArray(data)) throw new Error("Invalid format");
                let n = 0;
                for (const entry of data) {
                    if (!entry.blobData) continue;
                    const blob = await (await fetch(entry.blobData)).blob();
                    await db.saveDocument({ id: entry.id || crypto.randomUUID(), name: entry.name,
                        profile: entry.profile || 'Self', type: entry.type || blob.type, blob,
                        originalName: entry.originalName || entry.name, size: blob.size,
                        addedAt: entry.addedAt || Date.now() });
                    n++;
                }
                alert(`Restored ${n} documents!`); loadDocuments();
            } catch (err) { alert("Restore failed."); }
            finally { btnRestore.disabled = false; restoreFileInput.value = ''; }
        });

        // ============================
        //  KIT BUILDER (Module 5)
        // ============================
        const kitExam = document.getElementById('kitExam');
        const kitRequirements = document.getElementById('kitRequirements');
        const kitDocSelectors = document.getElementById('kitDocSelectors');
        const btnGenerateKit = document.getElementById('btnGenerateKit');
        const kitStatus = document.getElementById('kitStatus');
        let kitInited = false;

        function initKitTab() {
            if (kitInited) return; kitInited = true;
            for (const [key, val] of Object.entries(presets)) {
                if (key === 'CUSTOM') continue;
                const opt = document.createElement('option');
                opt.value = key; opt.textContent = val.name;
                kitExam.appendChild(opt);
            }
            kitExam.addEventListener('change', updateKitUI);
            updateKitUI();
        }

        async function updateKitUI() {
            const preset = presets[kitExam.value]; if (!preset) return;
            const docTypes = Object.keys(preset).filter(k => k !== 'name' && preset[k]);
            kitRequirements.innerHTML = '<h3>Requirements</h3>' + docTypes.map(dt => `<div class="kit-req-item">${preset[dt].label}</div>`).join('');

            const imageDocs = (await db.getAllDocuments()).filter(d => d.type?.startsWith('image/'));
            kitDocSelectors.innerHTML = '<h3>Select Source Documents</h3>';
            for (const dt of docTypes) {
                const g = document.createElement('div'); g.className = 'kit-selector-group';
                g.innerHTML = `<label>${dt.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>`;
                const sel = document.createElement('select'); sel.id = `kit_doc_${dt}`;
                sel.innerHTML = '<option value="">— Select —</option>' +
                    imageDocs.map(d => `<option value="${d.id}">${esc(d.name)} (${formatBytes(d.size)})</option>`).join('');
                g.appendChild(sel); kitDocSelectors.appendChild(g);
            }
            btnGenerateKit.disabled = false;
        }

        btnGenerateKit.addEventListener('click', async () => {
            const preset = presets[kitExam.value]; if (!preset) return;
            btnGenerateKit.disabled = true;
            kitStatus.style.display = 'block'; kitStatus.className = 'kit-status processing';
            kitStatus.textContent = 'Processing...';
            try {
                const zip = new window.ZipBuilder();
                const docTypes = Object.keys(preset).filter(k => k !== 'name' && preset[k]);
                let n = 0;
                for (const dt of docTypes) {
                    const docId = document.getElementById(`kit_doc_${dt}`)?.value;
                    if (!docId) continue;
                    const doc = await db.getDocument(docId);
                    if (!doc?.blob) continue;
                    const spec = preset[dt];
                    kitStatus.textContent = `Processing ${dt}...`;
                    const result = await window.ImageProcessor.processImage(doc.blob, {
                        exactWidth: spec.width, exactHeight: spec.height,
                        maxSizeKB: spec.maxSizeKB, outputType: spec.format
                    });
                    const ext = spec.format === 'image/jpeg' ? '.jpg' : '.png';
                    await zip.addFile(`${dt}_${spec.width}x${spec.height}${ext}`, result);
                    n++;
                }
                if (!n) {
                    kitStatus.className = 'kit-status warn';
                    kitStatus.textContent = 'Select at least one document.';
                    btnGenerateKit.disabled = false; return;
                }
                kitStatus.textContent = 'Building ZIP...';
                const a = document.createElement('a');
                a.href = URL.createObjectURL(zip.generate());
                a.download = `${preset.name.replace(/[^a-zA-Z0-9]/g, '_')}_Kit.zip`;
                a.click();
                kitStatus.className = 'kit-status success';
                kitStatus.textContent = `✓ Downloaded! ${n} file(s) processed.`;
            } catch (err) {
                kitStatus.className = 'kit-status error';
                kitStatus.textContent = 'Error: ' + err.message;
            } finally { btnGenerateKit.disabled = false; }
        });

        // ============================
        //  TOOLS TAB (Module 8 + 9)
        // ============================
        let toolsInited = false;

        function initToolsTab() {
            if (toolsInited) return; toolsInited = true;

            // --- PIN Management ---
            // ... (existing PIN logic)
            const pinSetInput = document.getElementById('pinSetInput');
            const btnSetPin = document.getElementById('btnSetPin');
            const btnRemovePin = document.getElementById('btnRemovePin');
            const pinSetupRow = document.getElementById('pinSetupRow');
            const pinStatusMsg = document.getElementById('pinStatusMsg');

            chrome.storage.local.get(['docmorph_pin', 'docmorph_vault_encrypted'], (data) => {
                if (data.docmorph_pin) {
                    pinSetupRow.style.display = 'none';
                    btnRemovePin.style.display = 'block';
                    pinStatusMsg.textContent = '🔒 PIN is active';
                    pinStatusMsg.className = 'tool-status active';
                } else {
                    pinSetupRow.style.display = 'flex';
                    btnRemovePin.style.display = 'none';
                    pinStatusMsg.textContent = '';
                }

                if (data.docmorph_vault_encrypted) {
                    encryptionStatus.textContent = '🛡️ Vault Encryption Enabled';
                    encryptionStatus.className = 'tool-status active';
                    btnEnableEncryption.textContent = 'Update Password';
                }
            });

            // --- Vault Encryption ---
            const vaultPassInput = document.getElementById('vaultPassInput');
            const btnEnableEncryption = document.getElementById('btnEnableEncryption');
            const encryptionStatus = document.getElementById('encryptionStatus');

            btnEnableEncryption.addEventListener('click', async () => {
                const pass = vaultPassInput.value.trim();
                if (pass.length < 6) {
                    encryptionStatus.textContent = 'Password must be at least 6 characters.';
                    encryptionStatus.className = 'tool-status error';
                    return;
                }
                vaultPassword = pass;
                await chrome.storage.local.set({ docmorph_vault_encrypted: true });
                encryptionStatus.textContent = '🛡️ Encryption Active for this session.';
                encryptionStatus.className = 'tool-status success';
                vaultPassInput.value = '';
                btnEnableEncryption.textContent = 'Update Password';
                loadDocuments(); // Refresh to decrypt if needed
            });

            // --- Image to PDF ---
            // ... (rest of the tools logic)

            btnSetPin.addEventListener('click', async () => {
                const pin = pinSetInput.value.trim();
                if (!/^\d{4}$/.test(pin)) {
                    pinStatusMsg.textContent = 'PIN must be exactly 4 digits.';
                    pinStatusMsg.className = 'tool-status error';
                    return;
                }
                await chrome.storage.local.set({ docmorph_pin: pin });
                pinSetupRow.style.display = 'none';
                btnRemovePin.style.display = 'block';
                pinStatusMsg.textContent = '🔒 PIN set! Your vault is now protected.';
                pinStatusMsg.className = 'tool-status active';
                pinSetInput.value = '';
            });

            btnRemovePin.addEventListener('click', async () => {
                if (confirm('Remove PIN lock?')) {
                    await chrome.storage.local.remove('docmorph_pin');
                    pinSetupRow.style.display = 'flex';
                    btnRemovePin.style.display = 'none';
                    pinStatusMsg.textContent = '🔓 PIN removed.';
                    pinStatusMsg.className = 'tool-status';
                }
            });

            // --- Image to PDF ---
            const imgToPdfInput = document.getElementById('imgToPdfInput');
            const pdfStatus = document.getElementById('pdfStatus');

            imgToPdfInput.addEventListener('change', async (e) => {
                const file = e.target.files[0]; if (!file) return;
                if (!file.type.startsWith('image/')) {
                    pdfStatus.textContent = 'Please select an image file.';
                    pdfStatus.className = 'tool-status error'; return;
                }
                pdfStatus.textContent = 'Converting...';
                pdfStatus.className = 'tool-status';
                try {
                    const pdfBlob = await window.ImageProcessor.imageToPDF(file);
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(pdfBlob);
                    a.download = file.name.replace(/\.[^.]+$/, '') + '.pdf';
                    a.click();
                    pdfStatus.textContent = `✓ PDF downloaded! (${formatBytes(pdfBlob.size)})`;
                    pdfStatus.className = 'tool-status active';
                } catch (err) {
                    pdfStatus.textContent = 'Conversion failed: ' + err.message;
                    pdfStatus.className = 'tool-status error';
                }
                imgToPdfInput.value = '';
            });

            // --- Clear All ---
            document.getElementById('btnClearAll').addEventListener('click', async () => {
                const confirmText = prompt('Type "DELETE" to erase all DocMorph data:');
                if (confirmText !== 'DELETE') return;
                try {
                    const docs = await db.getAllDocuments();
                    for (const d of docs) await db.deleteDocument(d.id);
                    await chrome.storage.local.remove('docmorph_pin');
                    alert('All data cleared.');
                    loadDocuments();
                } catch (e) {
                    alert('Failed to clear data.');
                }
            });
        }

        // ============================
        //  HELPERS
        // ============================
        function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        function formatBytes(bytes) {
            if (!+bytes) return '0 B';
            const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${['B', 'KB', 'MB', 'GB'][i]}`;
        }
    } // end startApp

    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
});
