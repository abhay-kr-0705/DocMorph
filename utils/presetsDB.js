// utils/presetsDB.js
// Module 4: Form Requirement Intelligence — Indian Exam Presets

const EXAM_PRESETS = {
    "SSC_CGL": {
        name: "SSC CGL / CHSL / MTS",
        photo: { width: 100, height: 120, maxSizeKB: 20, format: "image/jpeg", label: "Photo (100×120, <20KB)" },
        signature: { width: 140, height: 60, maxSizeKB: 10, format: "image/jpeg", label: "Signature (140×60, <10KB)" }
    },
    "UPSC_CSE": {
        name: "UPSC Civil Services",
        photo: { width: 413, height: 531, maxSizeKB: 300, format: "image/jpeg", label: "Photo (413×531, <300KB)" },
        signature: { width: 600, height: 200, maxSizeKB: 100, format: "image/jpeg", label: "Signature (600×200, <100KB)" }
    },
    "NEET": {
        name: "NEET UG / PG",
        photo: { width: 276, height: 354, maxSizeKB: 100, format: "image/jpeg", label: "Photo (276×354, 10-100KB)" },
        signature: { width: 220, height: 75, maxSizeKB: 50, format: "image/jpeg", label: "Signature (220×75, 4-50KB)" },
        thumbImpression: { width: 220, height: 75, maxSizeKB: 50, format: "image/jpeg", label: "Thumb (220×75, <50KB)" }
    },
    "JEE_MAIN": {
        name: "JEE Main / Advanced",
        photo: { width: 276, height: 354, maxSizeKB: 200, format: "image/jpeg", label: "Photo (276×354, <200KB)" },
        signature: { width: 600, height: 200, maxSizeKB: 30, format: "image/jpeg", label: "Signature (600×200, <30KB)" }
    },
    "IBPS_PO": {
        name: "IBPS PO / Clerk / RRB",
        photo: { width: 200, height: 230, maxSizeKB: 50, format: "image/jpeg", label: "Photo (200×230, 20-50KB)" },
        signature: { width: 140, height: 60, maxSizeKB: 20, format: "image/jpeg", label: "Signature (140×60, 10-20KB)" },
        leftThumb: { width: 240, height: 240, maxSizeKB: 50, format: "image/jpeg", label: "Left Thumb (240×240, 20-50KB)" }
    },
    "RRB_NTPC": {
        name: "RRB NTPC / Group D",
        photo: { width: 140, height: 160, maxSizeKB: 50, format: "image/jpeg", label: "Photo (140×160, <50KB)" },
        signature: { width: 200, height: 70, maxSizeKB: 30, format: "image/jpeg", label: "Signature (200×70, <30KB)" }
    },
    "NTA_CUET": {
        name: "CUET UG / PG",
        photo: { width: 276, height: 354, maxSizeKB: 300, format: "image/jpeg", label: "Photo (276×354, <300KB)" },
        signature: { width: 600, height: 200, maxSizeKB: 60, format: "image/jpeg", label: "Signature (600×200, <60KB)" }
    },
    "GATE": {
        name: "GATE",
        photo: { width: 480, height: 640, maxSizeKB: 200, format: "image/jpeg", label: "Photo (480×640, <200KB)" },
        signature: { width: 480, height: 160, maxSizeKB: 100, format: "image/jpeg", label: "Signature (480×160, <100KB)" }
    },
    "CUSTOM": {
        name: "Custom Dimensions",
        photo: null,
        signature: null
    }
};

// Expose globally
if (typeof window !== 'undefined') window.EXAM_PRESETS = EXAM_PRESETS;
if (typeof self !== 'undefined' && typeof window === 'undefined') self.EXAM_PRESETS = EXAM_PRESETS;

