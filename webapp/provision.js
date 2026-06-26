import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Automatic MAC Formatter Logic ---
document.getElementById('espMac').addEventListener('input', function (e) {
    let cursorPosition = e.target.selectionStart;
    let value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''); // Remove non-hex chars
    let formatted = "";

    for (let i = 0; i < value.length && i < 12; i++) {
        formatted += value[i];
        // Add colon after every 2 chars, but not at the very end
        if ((i + 1) % 2 === 0 && (i + 1) < value.length && (i + 1) < 12) {
            formatted += ":";
        }
    }

    e.target.value = formatted;

    // Maintain cursor position logic (basic)
    if (cursorPosition % 3 === 0) cursorPosition++;
});

window.registerDevice = async () => {
    const mac = document.getElementById('espMac').value.trim().toUpperCase();
    const uid = document.getElementById('ownerUid').value.trim();
    const name = document.getElementById('ownerName').value.trim();
    const status = document.getElementById('statusMsg');
    const btn = document.getElementById('regBtn');

    if (!mac || !uid || !name) {
        alert("Please fill all fields!");
        return;
    }

    // Basic MAC Format Validation
    const macRegex = /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/;
    if (!macRegex.test(mac)) {
        alert("Please enter a valid MAC Address (XX:XX:XX:XX:XX:XX)");
        return;
    }

    btn.disabled = true;
    status.style.color = "var(--primary)";
    status.innerText = "Registering...";

    try {
        // Create entry in device_registry node
        await set(ref(db, `device_registry/${mac}`), {
            owner_uid: uid,
            username: name,
            last_sync: Date.now()
        });

        status.style.color = "var(--success)";
        status.innerHTML = "✅ Device Linked Successfully!";
        
        // Clear form
        document.getElementById('espMac').value = "";
        document.getElementById('ownerUid').value = "";
        document.getElementById('ownerName').value = "";

    } catch (error) {
        console.error(error);
        status.style.color = "var(--danger)";
        status.innerText = "Error: " + error.message;
    } finally {
        btn.disabled = false;
    }
};