import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, update, remove, push, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from './config.js';

// --- INITIALIZE CORE FIREBASE APPLIANCE HANDLES ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTS ---
export { auth, db, onAuthStateChanged, signOut, ref, onValue, update, remove, push, get, set };

// --- GLOBAL NETWORKING STATES ---
export let currentUser = null;
export let userInventoryPath = "";
export let userCartPath = "";
export let isSaving = false;

// --- STATE MUTATORS ---
export const setSavingStatus = (status) => { isSaving = status; };

/**
 * IOT STATE MUTATOR: Embedded Peripheral Synchronization Vector
 * Updates the global application status parameter to drive hardware alerts on the ESP32 screen.
 */
export const setIoTStatus = (status) => {
    return update(ref(db), { app_status: status });
};

/**
 * LIFECYCLE LISTENER: Authentication Reference Switcher
 * Monitors global session state shifts and maps active data paths for the authenticated user context.
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userInventoryPath = `users/${user.uid}/inventory`;
        userCartPath = `users/${user.uid}/cart`;
    } else {
        currentUser = null;
        userInventoryPath = "";
        userCartPath = "";
    }
});

/**
 * TRANSACTION CORE: Deterministic Inventory Save & Aggregation Routine
 * Drives the system's high-efficiency point-of-entry pipeline. Evaluates incoming payloads 
 * against name-containment boundaries and merges quantitational metrics cleanly.
 */
export async function saveToFirebase(name, date, qty = 1, ts = 0) {
    console.log("=== DB RECEIVED NAME ==:", name);
    if (!auth.currentUser || isSaving) return false;
    
    const uid = auth.currentUser.uid;
    const invPath = `users/${uid}/inventory`;
    
    setSavingStatus(true);
    setIoTStatus("Saving...");
    
    const safeDate = date || "Manual Check";
    const inventoryRef = ref(db, invPath);
    
    try {
        // Query current bucket configuration to check for duplicate name keys or product families
        const snapshot = await get(inventoryRef);
        const currentData = snapshot.val();
        let existingKey = null;

        if (currentData) {
            existingKey = Object.keys(currentData).find(key => {
                const currentInvName = (currentData[key].product_name || "").toLowerCase();
                const incomingScanName = name.toLowerCase();
                
                // Smart Match Structural Ruleset: Validates exact equalities or multi-pack containment strings
                const isNameMatch = currentInvName === incomingScanName || 
                                    currentInvName.includes(incomingScanName) || 
                                    incomingScanName.includes(currentInvName);
                                    
                const isDateMatch = currentData[key].expiry_date === safeDate;
                
                return isNameMatch && isDateMatch;
            });
        }

        if (existingKey) {
            // MERGE TRANSACTION FLOW: Item match identified. Increment active inventory indices.
            const existingQty = parseInt(currentData[existingKey].quantity) || 0;
            const newQty = existingQty + parseInt(qty);
            
            // Enforce and overwrite using the master primary string value fetched from clean tables
            await update(ref(db, `${invPath}/${existingKey}`), { 
                product_name: name,
                quantity: newQty,
                expiry_timestamp: ts 
            });
        } else {
            // NEW ENTITY FLOW: Append a fresh ledger node with explicit timestamps for ESP32 index arrays
            await push(inventoryRef, {
                product_name: name,
                expiry_date: safeDate,
                expiry_timestamp: ts, 
                status: 'Packed',
                quantity: parseInt(qty),
                timestamp: Date.now() 
            });
        }
        
        // Broadcast completion signals across the hardware data bus
        setIoTStatus("Done");
        
        // Re-align system back to standby state parameters after execution cooldown window
        setTimeout(() => {
            setIoTStatus("Ready");
            setSavingStatus(false);
        }, 1500);

        return true;

    } catch (error) {
        console.error("Firebase DB Error:", error);
        setSavingStatus(false);
        setIoTStatus("Error");
        return false;
    }
}

/**
 * RUNTIME WINDOW ATTACHMENT: Session Disposal Vector
 */
window.logout = () => {
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace("auth.html");
        }).catch(err => console.error("Logout Error:", err));
    }
};