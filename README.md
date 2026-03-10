# DocMorph Walkthrough

Your privacy-focused, 100% free document filling tool is now fully built! It addresses your core problem: securely storing standard documents (photos, signatures, certificates) and inserting them into web forms at the precise sizes/restrictions needed without sending data to any servers.

## What Was Accomplished
1. **Core Vault UI**: A beautiful popup `IndexedDB`-backed vault where users can upload and manage standard files (Aadhaar cards, Profile Photos, etc.).
2. **Page Injection**: A content script that automatically detects `<input type="file">` on *any* webpage and injects a "DocMorph: Fill from Vault" button seamlessly next to it.
3. **On-the-fly Image Compression**: If a form requires a signature `< 50KB`, DocMorph processes the image precisely to hit that mark directly within the client's browser using HTML5 Canvas.

## How to Test It Locally

### Installation
1. Open up your browser:
   - For **Chrome**: Go to `chrome://extensions`
   - For **Edge**: Go to `edge://extensions`
2. Enable **Developer Mode** using the toggle in the top right.
3. Click **"Load unpacked"**.
4. Select the folder containing this repository's code.
5. Pin the "DocMorph" shield icon to your toolbar.

### Basic Workflow
1. **Fill Your Vault**: Click the DocMorph icon in your browser toolbar. Upload a sample photo to it and name it "Main Profile Picture".
2. **Test Injection**: Go to any page with a file input (for example, navigate to an online converter site, your university form, or literally any page that has a "Browse" or "Choose File" button).
3. **Magic Button**: You will see a `DocMorph` shield button materialize next to the input.
4. **Auto-Fill & Compress**: Click the button, select your "Main Profile Picture" from the overlay, enter a target size if required by the form (e.g., max 50KB), and click **Fill Form**. The system will compress it via Canvas API and directly inject the resulting `Blob` into the page's input. 

> **Note**:  
> The extension is entirely offline and strictly local. You incur zero server costs, and your documents are processed inside your browser instance safely.
