import { db, userInventoryPath, userCartPath, saveToFirebase, setIoTStatus } from './db.js';
import { ref, onValue, remove, update, get, off, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- SYSTEM MODULE STORAGE ENGINE ---
let currentCartSortMode = "expiry";
let cachedCart = [];
let isCartListenerAttached = false; 

// --- STATE INITIALIZATION BINDERS ---
window.addEventListener('authReady', () => {
    isCartListenerAttached = false; // Reset lock flag to permit clean listener instantiation
    setupCartListener();
    initSortListener();
});

/**
 * UTILITY: Serialization Wrapper
 * Serializes standard visual date tokens into simple Unix timestamps for ESP32 parsing loops.
 */
function getTimestampFromDate(dateStr) {
    try {
        const parts = dateStr.split("/");
        const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return Math.floor(dateObj.getTime() / 1000);
    } catch (e) {
        return 0;
    }
}

/**
 * UI BINDER: Dropdown Menu Event Hook
 */
function initSortListener() {
    const cartSortDropdown = document.getElementById('cartSortDropdown');
    if (cartSortDropdown) {
        cartSortDropdown.value = currentCartSortMode;
        cartSortDropdown.addEventListener('change', (e) => {
            currentCartSortMode = e.target.value;
            renderCartTable();
        });
    }
}

/**
 * REAL-TIME STREAM PIPELINE: Firebase Shopping List Consumer
 * Establishes a synchronized reactive listener over user-partitioned grocery records.
 */
export function setupCartListener() {
    if (!userCartPath || isCartListenerAttached) return;

    const cartRef = ref(db, userCartPath);
    
    // Explicitly detach ghost asynchronous loops prior to binding fresh streams
    off(cartRef);

    onValue(cartRef, (snapshot) => {
        const data = snapshot.val();
        // Manifest clean entities within memory storage blocks to eliminate trace leaks
        cachedCart = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        renderCartTable();
    });

    isCartListenerAttached = true;
    console.log("Cart Listener active and secured.");
}

/**
 * DATA ARCHITECTURE RULE: Smart Concurrency Combiner
 * Intercepts duplicate name tokens to aggregate quantities symmetrically rather than spawning new rows.
 */
export async function smartAddToCart(item) {
    if (!userCartPath) return;

    // Clean paths of invalid characters to secure safe Realtime Database path allocations
    const itemKey = item.product_name.trim().toUpperCase().replace(/[.#$[\]]/g, "_");
    const itemRef = ref(db, `${userCartPath}/${itemKey}`);
    
    try {
        const snap = await get(itemRef);
        const existing = snap.val();

        if (existing) {
            const currentQty = parseInt(existing.quantity) || 1;
            const addedQty = parseInt(item.quantity) || 1;
            
            await update(itemRef, {
                quantity: currentQty + addedQty,
                expiry_date: item.expiry_date, 
                product_name: item.product_name 
            });
        } else {
            await set(itemRef, {
                product_name: item.product_name,
                expiry_date: item.expiry_date,
                quantity: parseInt(item.quantity) || 1
            });
        }
    } catch (err) {
        console.error("SmartAddToCart Error:", err);
    }
}

/**
 * UI GENERATOR: Relational DOM Compiler
 * Evaluates memory structures against sorting rules and mounts innerHTML content.
 */
function renderCartTable() {
    const cartBody = document.getElementById('cart-table');
    const countDisplay = document.getElementById('cart-count-display');
    if (!cartBody) return;

    cartBody.innerHTML = ""; 
    let items = [...cachedCart];

    // --- CHRONOLOGICAL & ALPHABETICAL MULTI-MODE SORTING MATRIX ---
    if (currentCartSortMode === "expiry") {
        items.sort((a, b) => parseDate(a.expiry_date) - parseDate(b.expiry_date));
    } else if (currentCartSortMode === "name") {
        items.sort((a, b) => a.product_name.localeCompare(b.product_name));
    } else if (currentCartSortMode === "quantity") {
        items.sort((a, b) => (b.quantity || 1) - (a.quantity || 1));
    }

    let htmlContent = "";

    if (items.length > 0) {
        items.forEach(item => {
            htmlContent += `
                <tr>
                    <td class="product-name-cell"><strong>${item.product_name}</strong></td>
                    <td style="text-align: center;">
                        <div class="qty-controls">
                            <button onclick="changeCartQty('${item.id}', -1)">-</button>
                            <span>${item.quantity || 1}</span>
                            <button onclick="changeCartQty('${item.id}', 1)">+</button>
                        </div>
                    </td>
                    <td style="text-align: center; color: #666;">${item.expiry_date}</td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="btn-scan" style="padding: 5px 10px; font-size: 0.75rem; background: #2ecc71;" 
                                onclick="openRestockModal('${item.id}', '${item.product_name}', ${item.quantity || 1})">
                                <i class="fas fa-plus"></i> RESTOCK
                            </button>
                            <button class="btn-del" onclick="deleteFromCart('${item.id}')" style="padding: 5px 10px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
        cartBody.innerHTML = htmlContent;
    } else {
        cartBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 40px; color:#999;'>Your shopping list is clear!</td></tr>";
    }

    if (countDisplay) countDisplay.innerText = items.length;
}

/**
 * MUTATOR HANDLER: Step-wise Quantity Controller
 */
window.changeCartQty = async (id, delta) => {
    const itemRef = ref(db, `${userCartPath}/${id}`);
    const snap = await get(itemRef);
    const item = snap.val();
    if (!item) return;

    let nQty = (parseInt(item.quantity) || 1) + delta;
    if (nQty <= 0) {
        if (confirm("Remove this item from cart?")) remove(itemRef);
    } else {
        update(itemRef, { quantity: nQty });
    }
};

/**
 * DIALOG ROUTER: Modal Orchestrator
 * Captures row tracking properties and binds targeted action controllers dynamically.
 */
window.openRestockModal = (cartId, name, currentQty) => {
    window.currentRestockId = cartId; 
    console.log("Restocking ID captured:", cartId);
    
    const modal = document.getElementById('manualModal');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    
    if (modal) {
        document.getElementById('manualName').value = name;
        document.getElementById('manualDate').value = ""; 
        document.getElementById('manualQty').value = currentQty; 
        
        // Dynamic Intercept: Remaps the action execution route to target restock pipelines safely
        if (confirmBtn) {
            confirmBtn.setAttribute('onclick', 'submitRestockEntry()');
        }
        
        modal.style.setProperty('display', 'block', 'important');
    }
};

/**
 * TRANSACTION PIPELINE: Verified Cloud Restock Router
 * Moves verified shopping configurations into inventory paths and drops reference cart ids.
 */
window.submitRestockEntry = async () => {
    const idToDelete = window.currentRestockId;
    
    const name = document.getElementById('manualName').value.trim();
    const date = document.getElementById('manualDate').value.trim();
    const qty = parseInt(document.getElementById('manualQty').value) || 1;
    
    if (name && date) {
        if (!date.includes('/')) {
            alert("Please use DD/MM/YYYY format");
            return;
        }

        const ts = getTimestampFromDate(date);
        
        try {
            // 1. Relocate data configuration over to cloud inventory paths
            const success = await saveToFirebase(name, date, qty, ts);
            
            if (success) {
                // 2. Clear out the corresponding tracking entity inside the shopping list
                if (idToDelete) {
                    const itemRef = ref(db, `${userCartPath}/${idToDelete}`);
                    await remove(itemRef);
                    console.log("Cleanup: Removed captured ID from cart:", idToDelete);
                }
                
                window.currentRestockId = null;
                window.closeManualModal();
            }
        } catch (err) {
            console.error("Restock Flow Error:", err);
        }
    } else {
        alert("Please fill in both name and date!");
    }
};

/**
 * UTILITY: Low-level Date Object Evaluator
 */
function parseDate(dStr) {
    if (!dStr || typeof dStr !== 'string' || dStr.includes("Check")) return new Date(8640000000000000);
    const p = dStr.split('/');
    if (p.length !== 3) return new Date(8640000000000000);
    return new Date(p[2], p[1] - 1, p[0]);
}

/**
 * ACTION WINDOW ATTACHMENT: Delete Row Vector
 */
window.deleteFromCart = (id) => {
    if (confirm("Remove from shopping list?")) {
        remove(ref(db, `${userCartPath}/${id}`));
    }
};

/**
 * ACTION WINDOW ATTACHMENT: Modal Teardown Vector
 * Safely unbinds dynamic routes and returns hardware signals back to default standby modes.
 */
window.closeManualModal = () => {
    const modal = document.getElementById('manualModal');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    
    if (modal) modal.style.setProperty('display', 'none', 'important');
    
    // Restore default creation binding upon closing target dialog frame
    if (confirmBtn) {
        confirmBtn.setAttribute('onclick', 'submitManualEntry()');
    }
    
    setIoTStatus("Ready");
    window.currentRestockId = null; 
};

/**
 * UI COMPONENT INTERCEPT: HTML5 Input Syncer
 */
window.syncPickerToText = (v) => {
    if (!v) return;
    const [y, m, d] = v.split('-');
    document.getElementById('manualDate').value = `${d}/${m}/${y}`;
};