import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from './config.js';

// --- INITIALIZE CORE FIREBASE INSTANCES ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); 

/**
 * UI CONTROLLER: Component Loading State Mutator
 * Disables submission controls and generates spinners to prevent overlapping request loops.
 */
const setBtnLoading = (btnId, textId, isLoading, defaultText) => {
    const btn = document.getElementById(btnId);
    const text = document.getElementById(textId);
    if (!btn) return;
    
    if (isLoading) {
        btn.disabled = true;
        btn.style.opacity = "0.7";
        text.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
        text.innerText = defaultText;
    }
};

/**
 * HANDLER: Secure Authentication Vector
 * Authenticates credentials against Firebase Auth and caches session keys locally.
 */
window.handleLogin = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();

    if (!email || !pass) {
        alert("Please enter both email and password.");
        return;
    }

    setBtnLoading('loginBtn', 'loginText', true, "");

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        
        localStorage.setItem("user_uid", user.uid);
        
        // Priority Selection: Internal Auth profile DisplayName -> Fallback to Email Prefix String
        const displayName = user.displayName || user.email.split('@')[0].toUpperCase();
        localStorage.setItem("user_display_name", displayName);
        
        window.location.href = "index.html"; 
    } catch (error) {
        console.error(error);
        let msg = "Login Failed: ";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            msg += "Incorrect email or password.";
        } else {
            msg += error.message;
        }
        
        alert(msg);
        setBtnLoading('loginBtn', 'loginText', false, "LOGIN TO FRIDGE");
    }
};

/**
 * HANDLER: Account Provisioning and Profile Node Bootstrap Vector
 * Compiles user database paths and builds the decoupled profile record on initial account setup.
 */
window.handleRegister = async () => {
    const emailInput = document.getElementById('regEmail').value.trim();
    const userInput = document.getElementById('regUser').value.trim();
    const passInput = document.getElementById('regPass').value.trim();

    if (!emailInput || !passInput || !userInput) {
        alert("Please fill all fields.");
        return;
    }

    setBtnLoading('regBtn', 'regText', true, "");

    try {
        // 1. Provision security credentials inside Firebase Auth backend
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passInput);
        const user = userCredential.user;
        
        // 2. Commit customized capitalization username string to internal profile record
        await updateProfile(user, {
            displayName: userInput.toUpperCase()
        });

        // 3. ARCHITECTURE UPDATE: Bootstrap target profile directory branch inside Realtime Database
        // Establishes data integrity paths prior to any initial inventory additions
        await set(ref(db, `users/${user.uid}/profile`), {
            username: userInput.toUpperCase(),
            email: emailInput,
            created_at: Date.now()
        });
        
        alert(`Account Created for ${userInput.toUpperCase()}! You can now login.`);
        
        if (typeof window.toggleAuth === "function") {
            window.toggleAuth();
        } else {
            location.reload();
        }
    } catch (error) {
        console.error(error);
        alert("Registration Failed: " + error.message);
        setBtnLoading('regBtn', 'regText', false, "CREATE ACCOUNT");
    }
};