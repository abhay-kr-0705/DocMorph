// background.js
// A basic service worker for DocMorph extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('DocMorph extension installed successfully.');
  // Initialize default settings if needed
  chrome.storage.local.set({ isEnabled: true });
});

// Since the processing is done locally via IndexedDB and Canvas in the context
// of either the Popup or the Content Script, the background script mainly 
// acts as a coordinator or to handle specific generic browser events.
