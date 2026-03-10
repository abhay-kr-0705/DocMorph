# DocMorph: The Ultimate Form Helper Toolkit

Your privacy-focused, 100% free toolkit for managing documents, profiles, and autofilling web forms locally! 

## Features
- **Universal Local Vault**: Store your Aadhaar, Signature, and Passport photos safely in your browser. All data stays offline.
- **Smart Form Autofill**: Click the floating DocMorph widget on any form page to instantly populate text fields with your stored personal profile.
- **On-the-fly Image Compression**: If a form requires a signature `< 50KB`, DocMorph auto-compresses it via Canvas to hit that mark directly within the browser without uploading anywhere.
- **Vault Export/Backup**: Generate a local JSON backup of your highly sensitive document vault at any time.

## How to Test It Locally

### Installation
1. Go to `chrome://extensions` or `edge://extensions`.
2. Ensure **Developer Mode** is enabled.
3. Click **"Load unpacked"** and select the folder containing this code.
4. Pin the "DocMorph" shield icon to your toolbar.

### Basic Workflow
1. **Setup Your Profile:** Click the DocMorph icon in your browser toolbar. Go to the **My Profile** tab, fill out your details, and click "Save Profile Locally".
2. **Setup Your Vault:** Go to the **Document Vault** tab, drop in a sample signature or photo, assign it a tag (e.g., "Self") and save it.
3. **Test Autofill (Text):** 
   - Open any dummy web form or online application.
   - You will see a `DocMorph Autofill Text Form` floating button on the bottom-left. Click it. 
   - Watch the fields automatically populate with your profile data!
4. **Test Document Fill (Files):** 
   - On that same form page, find a "Choose File" button.
   - Click the `DocMorph: Fill from Vault` injected button next to it.
   - Select your document, apply an auto-compress size (like 40KB), and hit Fill.
