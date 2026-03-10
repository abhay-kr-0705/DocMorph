// popup/script.js
// DocMorph Popup — Vault + Profile + Kit Builder + Error Fixer

document.addEventListener('DOMContentLoaded', async () => {
    const errorOverlay = document.getElementById('errorOverlay');
    const appContainer = document.getElementById('appContainer');
    const db = window.DocMorphDB;

    try {
        await db.init();
    } catch (err) {
        console.error("DocMorph DB Init Error:", err);
        errorOverlay.style.display = 'flex';
        Array.from(appContainer.children).forEach(c => {
            if (c.id !== 'errorOverlay') c.style.display = 'none';
        });
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
        });
    });

    // ============================
    //  PROFILE MODULE
    // ============================
    const profileForm = document.getElementById('profileForm');
    const profileSaveMsg = document.getElementById('profileSaveMsg');
    const profileFields = ['name', 'dob', 'phone', 'email', 'fatherName', 'category', 'address', 'gender', 'state', 'pincode'];

    function pEl(f) { return document.getElementById(`p_${f}`); }

    async function loadProfile() {
        try {
            const p = await db.getProfile();
            if (p) profileFields.forEach(f => { const el = pEl(f); if (el) el.value = p[f] || ''; });
        } catch (e) { console.error("Error loading profile:", e); }
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
    const btnBackup = document.getElementById('btnBackup');
    const btnRestore = document.getElementById('btnRestore');
    const restoreFileInput = document.getElementById('restoreFileInput');

    let currentFile = null;

    // Populate exam presets dropdown
    const presets = window.EXAM_PRESETS;
    for (const [key, val] of Object.entries(presets)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = val.name;
        examPresetSelect.appendChild(opt);
    }

    examPresetSelect.addEventListener('change', () => {
        const v = examPresetSelect.value;
        if (v === 'none') {
            docTypeGroup.style.display = 'none';
            customDims.style.display = 'none';
            validationInfo.style.display = 'none';
        } else if (v === 'CUSTOM') {
            docTypeGroup.style.display = 'none';
            customDims.style.display = 'block';
            validationInfo.style.display = 'none';
        } else {
            docTypeGroup.style.display = 'block';
            customDims.style.display = 'none';
            updateValidationInfo();
        }
    });

    docTypeSelect.addEventListener('change', updateValidationInfo);

    function updateValidationInfo() {
        const preset = presets[examPresetSelect.value];
        if (!preset) return;
        const docType = docTypeSelect.value;
        const spec = preset[docType];
        if (spec) {
            validationInfo.style.display = 'block';
            validationInfo.className = 'validation-info info';
            validationInfo.innerHTML = `<strong>${preset.name}:</strong> ${spec.label}`;
        } else {
            validationInfo.style.display = 'block';
            validationInfo.className = 'validation-info warn';
            validationInfo.textContent = `No ${docType} spec for this exam. Use custom dimensions.`;
        }
    }

    loadDocuments();

    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => fileDropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(ev => fileDropArea.addEventListener(ev, () => fileDropArea.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(ev => fileDropArea.addEventListener(ev, () => fileDropArea.classList.remove('dragover'), false));
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
        } else {
            imagePreview.style.display = 'none';
        }
        fileDropArea.style.display = 'none';
        previewArea.style.display = 'flex';
        if (!docNameInput.value) {
            const base = file.name.split('.')[0];
            docNameInput.value = base.charAt(0).toUpperCase() + base.slice(1);
        }
        updateSaveBtn();
    }

    function updateSaveBtn() {
        btnSave.disabled = !(currentFile && docNameInput.value.trim());
    }

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
                            exactWidth: spec.width,
                            exactHeight: spec.height,
                            maxSizeKB: spec.maxSizeKB,
                            outputType: spec.format
                        });
                    }
                } else if (presetKey === 'CUSTOM') {
                    const cw = parseInt(document.getElementById('customW').value);
                    const ch = parseInt(document.getElementById('customH').value);
                    const ckb = parseInt(document.getElementById('customKB').value);
                    const opts = {};
                    if (cw && ch) { opts.exactWidth = cw; opts.exactHeight = ch; }
                    if (ckb) opts.maxSizeKB = ckb;
                    opts.outputType = 'image/jpeg';
                    result = await window.ImageProcessor.processImage(currentFile, opts);
                }
            }

            const doc = {
                id: crypto.randomUUID(),
                name: docNameInput.value.trim(),
                profile: docProfileSelect.value,
                type: result.type,
                blob: result,
                originalName: currentFile.name,
                size: result.size,
                addedAt: Date.now()
            };
            await db.saveDocument(doc);

            // Show validation result (Module 6)
            if (presetKey !== 'none' && presetKey !== 'CUSTOM') {
                const spec = presets[presetKey]?.[docTypeSelect.value];
                if (spec && result.size <= spec.maxSizeKB * 1024) {
                    validationInfo.className = 'validation-info success';
                    validationInfo.innerHTML = `✓ Saved! Size: ${formatBytes(result.size)} (limit: ${spec.maxSizeKB}KB)`;
                    validationInfo.style.display = 'block';
                } else if (spec) {
                    validationInfo.className = 'validation-info warn';
                    validationInfo.innerHTML = `⚠ File is ${formatBytes(result.size)} — exceeds ${spec.maxSizeKB}KB limit. Try lower quality source.`;
                    validationInfo.style.display = 'block';
                }
            }

            btnRemoveFile.click();
            docNameInput.value = '';
            examPresetSelect.value = 'none';
            examPresetSelect.dispatchEvent(new Event('change'));
            loadDocuments();
        } catch (error) {
            console.error("Save Error:", error);
            alert('Error: ' + error.message);
        } finally {
            btnSave.textContent = 'Save to Vault'; updateSaveBtn();
        }
    });

    filterProfileSelect.addEventListener('change', loadDocuments);

    async function loadDocuments() {
        try {
            let docs = await db.getAllDocuments();
            const fv = filterProfileSelect.value;
            if (fv !== 'All') docs = docs.filter(d => (d.profile || 'Self') === fv);

            documentList.innerHTML = '';
            docCount.textContent = docs.length;
            if (!docs.length) { emptyState.style.display = 'block'; return; }
            emptyState.style.display = 'none';

            docs.sort((a, b) => b.addedAt - a.addedAt).forEach(doc => {
                const item = document.createElement('div');
                item.className = 'doc-item';
                const isImg = doc.type?.startsWith('image/');
                const tag = doc.profile || 'Self';
                let preview = `<div class="doc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>`;
                if (isImg && doc.blob) {
                    preview = `<img src="${URL.createObjectURL(doc.blob)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;min-width:40px;">`;
                }
                item.innerHTML = `
                    <div class="doc-info">
                        ${preview}
                        <div class="doc-meta">
                            <span class="doc-name" title="${esc(doc.name)}">${esc(doc.name)}</span>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <span class="doc-tags">${esc(tag)}</span>
                                <span class="doc-size">• ${formatBytes(doc.size)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-icon" data-download="${doc.id}" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                        <button class="btn-icon del" data-id="${doc.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                `;
                documentList.appendChild(item);
            });

            // Download listeners
            documentList.querySelectorAll('[data-download]').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.currentTarget.getAttribute('data-download');
                    const doc = await db.getDocument(id);
                    if (doc?.blob) {
                        const url = URL.createObjectURL(doc.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = doc.originalName || doc.name;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                });
            });

            // Delete listeners
            documentList.querySelectorAll('.del').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Delete this document?')) { await db.deleteDocument(id); loadDocuments(); }
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
            for (const doc of docs) {
                exp.push({ id: doc.id, name: doc.name, profile: doc.profile, type: doc.type,
                    originalName: doc.originalName, size: doc.size, addedAt: doc.addedAt,
                    blobData: await blobToBase64(doc.blob) });
            }
            const blob = new Blob([JSON.stringify(exp)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
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
            alert(`Restored ${n} documents!`);
            loadDocuments();
        } catch (err) { alert("Restore failed: " + err.message); }
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
    let kitInitialized = false;

    function initKitTab() {
        if (kitInitialized) return;
        kitInitialized = true;

        // Populate kit exam dropdown (exclude CUSTOM and none)
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
        const key = kitExam.value;
        const preset = presets[key];
        if (!preset) return;

        // Show requirements
        const docTypes = Object.keys(preset).filter(k => k !== 'name' && preset[k]);
        kitRequirements.innerHTML = '<h3>Requirements</h3>' +
            docTypes.map(dt => `<div class="kit-req-item">${preset[dt].label}</div>`).join('');

        // Show doc selectors
        const allDocs = await db.getAllDocuments();
        const imageDocs = allDocs.filter(d => d.type?.startsWith('image/'));

        kitDocSelectors.innerHTML = '<h3>Select Source Documents</h3>';
        for (const dt of docTypes) {
            const group = document.createElement('div');
            group.className = 'kit-selector-group';
            group.innerHTML = `<label>${dt.charAt(0).toUpperCase() + dt.slice(1).replace(/([A-Z])/g, ' $1')}</label>`;
            const sel = document.createElement('select');
            sel.id = `kit_doc_${dt}`;
            sel.innerHTML = '<option value="">— Select from vault —</option>';
            imageDocs.forEach(doc => {
                sel.innerHTML += `<option value="${doc.id}">${esc(doc.name)} (${formatBytes(doc.size)})</option>`;
            });
            group.appendChild(sel);
            kitDocSelectors.appendChild(group);
        }

        btnGenerateKit.disabled = false;
    }

    btnGenerateKit.addEventListener('click', async () => {
        const key = kitExam.value;
        const preset = presets[key];
        if (!preset) return;

        btnGenerateKit.disabled = true;
        kitStatus.style.display = 'block';
        kitStatus.className = 'kit-status processing';
        kitStatus.textContent = 'Processing documents...';

        try {
            const zip = new window.ZipBuilder();
            const docTypes = Object.keys(preset).filter(k => k !== 'name' && preset[k]);
            let processed = 0;

            for (const dt of docTypes) {
                const sel = document.getElementById(`kit_doc_${dt}`);
                const docId = sel?.value;
                if (!docId) continue;

                const doc = await db.getDocument(docId);
                if (!doc?.blob) continue;

                const spec = preset[dt];
                kitStatus.textContent = `Processing ${dt}...`;

                // Process image to exact specs
                const result = await window.ImageProcessor.processImage(doc.blob, {
                    exactWidth: spec.width,
                    exactHeight: spec.height,
                    maxSizeKB: spec.maxSizeKB,
                    outputType: spec.format
                });

                const ext = spec.format === 'image/jpeg' ? '.jpg' : '.png';
                const fileName = `${dt}_${spec.width}x${spec.height}${ext}`;
                await zip.addFile(fileName, result);
                processed++;
            }

            if (processed === 0) {
                kitStatus.className = 'kit-status warn';
                kitStatus.textContent = 'No documents selected. Please choose at least one.';
                btnGenerateKit.disabled = false;
                return;
            }

            // Generate ZIP
            kitStatus.textContent = 'Building ZIP...';
            const zipBlob = zip.generate();
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${preset.name.replace(/[^a-zA-Z0-9]/g, '_')}_Kit.zip`;
            a.click();
            URL.revokeObjectURL(url);

            kitStatus.className = 'kit-status success';
            kitStatus.textContent = `✓ Kit downloaded! ${processed} document(s) processed.`;
        } catch (err) {
            console.error("Kit generation error:", err);
            kitStatus.className = 'kit-status error';
            kitStatus.textContent = 'Error: ' + err.message;
        } finally {
            btnGenerateKit.disabled = false;
        }
    });

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
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${['B', 'KB', 'MB'][i]}`;
    }

    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
});
