import { 
    auth, 
    db, 
    onAuthStateChanged, 
    update, 
    ref, 
    signOut 
} from './db.js';
import { setupDataListeners } from './ui.js';

// --- SYSTEM SHARED STATES ---
export let currentUser = null;
export let userInventoryPath = "";
export let userCartPath = "";
export let isProcessing = false; 

// Guard state to prevent multiple instantiation of database listeners
let isAppInitialized = false;

/**
 * GLOBAL AUTHENTICATION STATE GUARD
 * Monitors real-time auth lifecycle changes and provisions user path directories.
 */
onAuthStateChanged(auth, (user) => {
    const userDisplay = document.getElementById('user-display');
    const inventoryTable = document.getElementById('inventory-table');
    const cartTable = document.getElementById('cart-table');
    
    if (user) {
        currentUser = user;
        
        // 1. Sync active session state to local storage layers
        localStorage.setItem("user_uid", user.uid);
        localStorage.setItem("user_email", user.email);
        
        if (user.displayName) {
            localStorage.setItem("user_display_name", user.displayName);
        }

        // 2. Render authenticated profile header string
        if (userDisplay) {
            const cachedName = localStorage.getItem("user_display_name");
            userDisplay.innerText = cachedName || user.displayName || user.email.split('@')[0].toUpperCase();
        }

        // 3. Construct user-specific database paths
        userInventoryPath = `users/${user.uid}/inventory`;
        userCartPath = `users/${user.uid}/cart`;
        
        console.log("Session Verified. UID:", user.uid);

        // 4. Singleton Initialization Guard Execution
        if (!isAppInitialized) {
            // Wipes existing cache vectors to eliminate ghost rows on user context swaps
            if (inventoryTable) inventoryTable.innerHTML = ""; 
            if (cartTable) cartTable.innerHTML = "";

            // Link real-time visual streams if executing inside inventory context
            if (document.getElementById('inventory-table')) {
                setupDataListeners(); 
            }
            
            // Broadcast event so dependent asynchronous script models sync paths safely
            window.dispatchEvent(new Event('authReady'));
            
            isAppInitialized = true; 
            console.log("Application Modules Linked.");
        }

    } else {
        // Safe context teardown sequence upon user session invalidation
        isAppInitialized = false; 
        localStorage.clear(); 
        sessionStorage.clear(); 

        if (inventoryTable) inventoryTable.innerHTML = "";
        if (cartTable) cartTable.innerHTML = "";
        if (userDisplay) userDisplay.innerText = "Guest";

        if (!window.location.pathname.includes("auth.html")) {
            window.location.replace("auth.html");
        }
    }
});

/**
 * STATE MUTATOR: Processing Flag Mutator
 */
export const setProcessing = (status) => {
    isProcessing = status;
};

/**
 * IOT STATE MUTATOR: Embedded Display Gateway State Mutator
 * Modifies the synchronization flags to trigger remote animations on the ESP32 GLCD peripheral.
 */
export const setIoTStatus = (status) => {
    if (db) {
        update(ref(db), { app_status: status });
    }
};

/**
 * CONTROL WINDOW ATTACHMENT: Global SignOut Vector
 */
window.logout = () => {
    if (confirm("Are you sure you want to logout?")) {
        // Terminate ongoing operations and reset display loops before teardown
        setIoTStatus("Ready");
        
        signOut(auth).then(() => {
            localStorage.clear();
            sessionStorage.clear();
            isAppInitialized = false; 

            const inventoryTable = document.getElementById('inventory-table');
            const cartTable = document.getElementById('cart-table');
            if (inventoryTable) inventoryTable.innerHTML = "";
            if (cartTable) cartTable.innerHTML = "";

            window.location.replace("auth.html");
        }).catch(err => console.error("Logout Error:", err));
    }
};

console.log("Control Center (app.js) initialized.");