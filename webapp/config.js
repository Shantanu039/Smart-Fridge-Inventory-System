// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION ENGINE: SYSTEM ARCHITECTURE ENVIRONMENT KEYS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CORE ENVIRONMENT DEFINITIONS: Firebase Service credentials
 * Provisions the network gateway properties required to securely attach to your
 * central cloud storage architecture and isolated user buckets.
 */
export const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY_HERE",
    authDomain: "smartfridgeinventory-7112e.firebaseapp.com",
    databaseURL: "https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com",
    projectId: "smartfridgeinventory-7112e",
    storageBucket: "smartfridgeinventory-7112e.firebasestorage.app",
    messagingSenderId: "671738594769",
    appId: "1:671738594769:web:06c02b6f2ccb30d987ccf0"
};

/**
 * EXTERNAL INTEGRATIONS: Machine Vision & Engine Keys
 * VISION_API_KEY: Powers the Document OCR image analysis arrays in Google Cloud.
 * SERP_API_KEY: Serves as the fallback runtime lookup proxy engine layer.
 */
export const VISION_API_KEY = "YOUR_GOOGLE_VISION_API_KEY_HERE";
export const SERP_API_KEY = "YOUR_SERP_API_KEY_HERE";