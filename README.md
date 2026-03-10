# DocMorph — Secure Form Filler Browser Extension

**DocMorph** is a privacy-first Chrome extension that helps Indian students and job seekers prepare, store, and autofill documents for competitive exam applications (UPSC, NEET, JEE, SSC, IBPS, etc.) — **100% offline**, zero servers, zero cost.

## Features

### Core
- **Document Vault** — Store photos, signatures, certificates locally in IndexedDB
- **Profile Manager** — Save personal info (name, DOB, phone, address, category, etc.)
- **Form Autofill** — Floating button auto-fills text forms on any website using your profile
- **File Input Injection** — "Fill from Vault" button appears next to every `<input type="file">` on the web

### Document Processing
- **Exam Presets** — 8 Indian exams with official photo/signature specs (SSC, UPSC, NEET, JEE, IBPS, RRB, CUET, GATE)
- **Exact-Dimension Resize** — Center-crop images to pixel-perfect dimensions
- **Smart Compression** — Binary-search quality reduction to hit exact KB limits
- **Custom Dimensions** — Manual width × height × max KB override
- **Image → PDF** — Convert any image to a single-page A4 PDF (zero dependencies)

### Application Kit
- **Kit Builder** — Select an exam, pick your vault documents, and download a ready-to-upload `.zip` file
- **Zero-Dependency ZIP** — Built from scratch using PKZIP spec, no npm libraries

### Security & UX
- **PIN Lock** — 4-digit PIN protects the vault on shared computers
- **Quick Copy** — One-click clipboard copy for any profile field
- **Storage Stats** — See total documents and storage used
- **Backup/Restore** — Export your entire vault as JSON, import it back anytime
- **Dark Mode** — Automatic system-aware light/dark theme
- **Clear All Data** — Nuclear option with confirmation

### Privacy
- ✅ All data stays in your browser (IndexedDB + chrome.storage)
- ✅ No server, no cloud, no tracking
- ✅ No external dependencies (fonts, CDNs, npm)
- ✅ Full Manifest V3 compliance

## File Structure

```
FormFillingExtension/
├── manifest.json           # Chrome MV3 manifest
├── background.js           # Service Worker (central DB API)
├── content/
│   ├── content.js          # File input injection + autofill
│   └── content.css         # Injected UI styles
├── popup/
│   ├── index.html          # 4-tab popup (Vault, Profile, Kit, Tools)
│   ├── script.js           # All popup logic
│   └── style.css           # Popup styles with dark mode
└── utils/
    ├── indexedDbWrapper.js  # IndexedDB abstraction
    ├── imageProcessor.js   # Resize, crop, compress, image→PDF
    ├── presetsDB.js        # 8 exam presets with specs
    └── zipBuilder.js       # Zero-dep ZIP file builder
```

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. Click the DocMorph shield icon in your toolbar

## Usage

1. **Profile** → Fill in your details → Save
2. **Vault** → Upload documents with exam presets → Auto-processed
3. **Kit Builder** → Select exam → Pick docs → Download ZIP
4. **Tools** → Set PIN, convert images to PDF, manage data
5. Visit any form website → Use the floating **Autofill** button or **Fill from Vault** buttons

## Tech Stack

- Vanilla JavaScript (no frameworks)
- IndexedDB for document storage
- HTML5 Canvas for image processing
- Chrome Extensions Manifest V3
- Custom PDF builder (raw PDF spec)
- Custom ZIP builder (PKZIP spec)

## License

MIT — Free to use and modify.
