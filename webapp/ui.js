import { db, userInventoryPath, userCartPath, saveToFirebase, isSaving, setSavingStatus, setIoTStatus } from './db.js';
import { ref, onValue, remove, update, get, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { smartAddToCart } from './cart_logic.js';

// --- LOCAL STORAGE & RUNTIME SYSTEM VOLATILE MEMORY ---
let currentSortMode = localStorage.getItem('inventorySort') || "expiry";
let cachedInventory = [];
let networkIssueDetected = false;
let isListenerAttached = false; 

// --- ROUTINE BINDERS ---
window.addEventListener('authReady', () => {
    isListenerAttached = false;
    setupDataListeners();
    checkNetworkHealth();
});

/**
 * UTILITY: Date Serialization Wrapper
 * Converts textual date variables (DD/MM/YYYY or MM/YYYY) cleanly to Unix timestamps.
 */
function getTimestampFromDate(dateStr) {
    try {
        const parts = dateStr.split("/");
        const d = parts.length === 3 ? parseInt(parts[0]) : 1;
        const m = parts.length === 3 ? parseInt(parts[1]) : parseInt(parts[0]);
        const y = parts.length === 3 ? parseInt(parts[2]) : parseInt(parts[1]);
        
        const dateObj = new Date(y, m - 1, d);
        return Math.floor(dateObj.getTime() / 1000);
    } catch (e) {
        return 0;
    }
}

/**
 * NETWORK DIAGNOSTICS: Asynchronous Health Verifier
 * Pins remote REST discovery spaces to gauge connectivity thresholds.
 */
function checkNetworkHealth() {
    fetch('https://vision.googleapis.com/$discovery/rest?version=v1', { mode: 'no-cors' })
        .catch(() => {
            networkIssueDetected = true;
            updateNotificationBanner(["⚠️ Connection limited. Falling back to Local OCR Mode."]);
        });
}

const sortDropdown = document.getElementById('sortDropdown');
if (sortDropdown) {
    sortDropdown.value = currentSortMode;
    sortDropdown.addEventListener('change', (e) => {
        currentSortMode = e.target.value;
        localStorage.setItem('inventorySort', currentSortMode);
        renderTable();
    });
}

/**
 * UI ENGINE: Asynchronous Relational DOM Matrix Compiler
 * Evaluates real-time inventory nodes against expirational timelines. Converts items with past
 * timelines automatically into cart paths and flags soon-to-expire item rows natively.
 */
async function renderTable() {
    const tableBody = document.getElementById('inventory-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    const expiryDetails = [];
    let items = [...cachedInventory];

    if (currentSortMode === "expiry") items.sort((a, b) => parseDate(a.expiry_date) - parseDate(b.expiry_date));
    else if (currentSortMode === "name") items.sort((a, b) => a.product_name.localeCompare(b.product_name));
    else if (currentSortMode === "quantity") items.sort((a, b) => (b.quantity || 1) - (a.quantity || 1));

    let htmlContent = ""; 

    for (const item of items) {
        const days = calculateDaysLeft(item.expiry_date);
        
        if (days < 0) {
            // --- AUTO-MIGRATION TRANSACTION ENGINE ---
            if (!item.isMoving) { 
                item.isMoving = true;
                try {
                    await smartAddToCart({
                        product_name: item.product_name,
                        expiry_date: item.expiry_date,
                        quantity: item.quantity || 1
                    });
                    await remove(ref(db, `${userInventoryPath}/${item.id}`));
                } catch (e) {
                    item.isMoving = false;
                    console.error("Auto-move failed:", e);
                }
            }
            continue; 
        }

        let rowClass = "";
        if (days <= 3) {
            rowClass = "critical"; 
            expiryDetails.push(`• ${item.product_name} expiring in ${days} days`);
        } else if (days <= 7) {
            rowClass = "expiring-soon"; 
            expiryDetails.push(`• ${item.product_name} expiring in ${days} days`);
        }

        htmlContent += `
            <tr class="${rowClass}">
                <td class="product-name-cell"><strong>${item.product_name}</strong></td>
                <td style="text-align: center;">${item.expiry_date}</td>
                <td style="text-align: center;">
                    <div class="qty-controls">
                        <button onclick="changeQty('inventory', '${item.id}', -1)">-</button>
                        <span>${item.quantity || 1}</span>
                        <button onclick="changeQty('inventory', '${item.id}', 1)">+</button>
                    </div>
                </td>
                <td style="text-align: center;">
                    <select onchange="updateInvStatus('${item.id}', this.value)">
                        <option value="Packed" ${item.status === 'Packed' ? 'selected' : ''}>Packed</option>
                        <option value="Half-Used" ${item.status === 'Half-Used' ? 'selected' : ''}>Half-Used</option>
                        <option value="Finished">Finished</option>
                    </select>
                </td>
                <td style="text-align: center;"><button class="btn-del" onclick="deleteItem('${item.id}')">Remove</button></td>
            </tr>`;
    }
    
    tableBody.innerHTML = htmlContent;

    if (!networkIssueDetected) {
        updateNotificationBanner(expiryDetails);
    }
}

/**
 * SUBSCRIPTION ROUTINE: Firebase Core Node Stream Orchestrator
 */
export function setupDataListeners() {
    if (!userInventoryPath || isListenerAttached) return;
    const inventoryRef = ref(db, userInventoryPath);
    off(inventoryRef);
    onValue(inventoryRef, (snapshot) => {
        const data = snapshot.val();
        cachedInventory = []; 
        if (data) {
            cachedInventory = Object.keys(data).map(key => ({ 
                id: key, 
                ...data[key] 
            }));
        }
        renderTable();
    });
    isListenerAttached = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOG & INTERACTION MANAGEMENT ROUTINES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI INTERCEPT ENGINE: Modal Focus Manager
 * Mounts parsed barcode properties and moves input focus fields to cut consumer micro-latencies.
 */
window.showManualModal = (name = "", date = "") => {
    const nameInput = document.getElementById('manualName');
    const dateInput = document.getElementById('manualDate');
    
    nameInput.value = name;
    dateInput.value = date;
    document.getElementById('manualQty').value = 1; 
    document.getElementById('manualModal').style.setProperty('display', 'block', 'important');

    if (name && !date) {
        dateInput.focus();
    } else if (!name && date) {
        nameInput.focus();
    }
};

window.closeManualModal = () => {
    document.getElementById('manualModal').style.setProperty('display', 'none', 'important');
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) scanStatus.innerHTML = `<i class="fas fa-info-circle"></i> Ready to scan...`;
    
    setSavingStatus(false);
    setIoTStatus("Ready");
    if (window.currentRestockId) window.currentRestockId = null;
};

/**
 * UI CONTROLLER: Form Submission & Dynamic Machine Learning Autolearn Matrix
 * Persists curated data loops across core user inventories while simultaneously compiling newly discovered 
 * barcode associations into global enterprise product nodes to accelerate future scans.
 */
window.submitManualEntry = async () => {
    if (isSaving) return;
    
    const name = document.getElementById('manualName').value.trim();
    const date = document.getElementById('manualDate').value.trim(); 
    const qty = parseInt(document.getElementById('manualQty').value) || 1;
    
    if (name && date) {
        if (!date.includes('/')) {
            alert("Please use DD/MM/YYYY or MM/YYYY format");
            return;
        }

        const ts = getTimestampFromDate(date);
        const success = await saveToFirebase(name, date, qty, ts);
        
        if (success) {
            // --- AUTOMATED CLOUD GLOSSARY BACKFILL MACHINE ---
            if (window.pendingBarcodeToRegister) {
                try {
                    const checkMasterRef = ref(db, `products_database/${window.pendingBarcodeToRegister}`);
                    const snapshot = await get(checkMasterRef);
                    
                    // Prevent writing catalog properties if reference keys already hold verified definitions
                    if (!snapshot.exists()) {
                        await update(ref(db), { [`products_database/${window.pendingBarcodeToRegister}`]: name });
                        console.log(`[Registry Learned Brand-New Item]: ${window.pendingBarcodeToRegister} -> ${name}`);
                    } else {
                        console.log("[Registry Shield] Aborted cloud catalog rewrite to protect full pristine name.");
                    }
                    window.pendingBarcodeToRegister = null;
                } catch (registryErr) {
                    console.error("Auto-learning registration validation dropped:", registryErr);
                }
            }

            if (window.currentRestockId) {
                try {
                    await remove(ref(db, `${userCartPath}/${window.currentRestockId}`));
                    window.currentRestockId = null;
                } catch (err) {
                    console.error("Cart cleanup failed:", err);
                }
            }
            const scanStatus = document.getElementById('scan-status');
            if (scanStatus) scanStatus.innerHTML = `✅ Added <b>${name}</b>`;
            window.closeManualModal();
        }
    } else { 
        alert("Both Product Name and Expiry Date are required!"); 
    }
};

// --- ARITHMETIC UTILITIES ---
function parseDate(dStr) {
    if (!dStr || dStr.includes("Check")) return new Date(8640000000000000);
    const p = dStr.split('/');
    const day = p.length === 3 ? parseInt(p[0]) : 1;
    const month = p.length === 3 ? parseInt(p[1]) : parseInt(p[0]);
    const year = p.length === 3 ? parseInt(p[2]) : parseInt(p[1]);
    return new Date(year, month - 1, day);
}

function calculateDaysLeft(dStr) {
    const today = new Date(); 
    today.setHours(0,0,0,0);
    const target = parseDate(dStr);
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function updateNotificationBanner(msgs) {
    const banner = document.getElementById('notification-area');
    if (banner) {
        if (msgs.length > 0) {
            banner.style.display = 'block';
            banner.innerHTML = `<strong>Attention Required:</strong><br>${msgs.join('<br>')}`;
        } else { 
            banner.style.display = 'none'; 
        }
    }
}

// --- GLOBAL ACCESSIBLE CONTROL LAYERS ---
window.changeQty = async (type, id, delta) => {
    const path = type === 'inventory' ? userInventoryPath : userCartPath;
    const itemRef = ref(db, `${path}/${id}`);
    const snap = await get(itemRef);
    const item = snap.val();
    if (!item) return;
    let nQty = (item.quantity || 1) + delta;
    if (nQty <= 0) { 
        if (confirm("Remove this item?")) remove(itemRef); 
    } else {
        update(itemRef, { quantity: nQty });
    }
};

window.updateInvStatus = async (id, val) => {
    if (val === "Finished") {
        const snap = await get(ref(db, `${userInventoryPath}/${id}`));
        const item = snap.val();
        if (item && !item.isMoving) {
            item.isMoving = true;
            try {
                await smartAddToCart({ 
                    product_name: item.product_name, 
                    expiry_date: item.expiry_date, 
                    quantity: item.quantity || 1 
                });
                await remove(ref(db, `${userInventoryPath}/${id}`));
            } catch (error) {
                item.isMoving = false;
                alert("Failed to move item to cart.");
            }
        }
    } else {
        update(ref(db, `${userInventoryPath}/${id}`), { status: val });
    }
};

window.deleteItem = (id) => confirm("Remove from fridge?") && remove(ref(db, `${userInventoryPath}/${id}`));

window.syncPickerToText = (v) => {
    if (!v) return;
    const [y, m, d] = v.split('-');
    document.getElementById('manualDate').value = `${d}/${m}/${y}`;
};