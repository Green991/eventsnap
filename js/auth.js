import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// UI Elements
const loginBtn = document.getElementById('loginBtn');
const inviteModal = document.getElementById('inviteModal');
const inviteCodeInput = document.getElementById('inviteCodeInput');
const validateBtn = document.getElementById('validateBtn');
const inviteError = document.getElementById('inviteError');

// 1. Auth Listener (The Center of Truth)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("🟢 Auth State: User detected:", user.email);

        // Backup to SessionStorage immediately
        sessionStorage.setItem('temp_user_uid', user.uid);
        sessionStorage.setItem('temp_user_email', user.email);

        // HIDE LOGIN BUTTON (User is already here)
        if (loginBtn) loginBtn.style.display = 'none';

        // Auto-Check Existence (Redirects or shows modal)
        await checkUserExistence(user);

    } else {
        console.log("⚪ Auth State: No user");

        // Clear sensitive triggers
        sessionStorage.removeItem('temp_user_uid');
        sessionStorage.removeItem('temp_user_email');

        // RESET UI: Ensure modal is hidden and login is visible
        if (inviteModal) inviteModal.classList.add('hidden');
        if (loginBtn) loginBtn.style.display = 'inline-flex';
    }
});

// 2. Login Logic (Manual Trigger)
async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // We do NOT need to call checkUserExistence here because 
        // onAuthStateChanged will fire automatically!
    } catch (error) {
        console.error("Login failed:", error);
        alert("Error al iniciar sesión: " + error.message);
    }
}

// 3. Check Existence
async function checkUserExistence(user) {
    const userRef = doc(db, "users", user.uid);

    try {
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            console.log("User exists, redirecting...");
            window.location.href = "dashboard.html";
        } else {
            console.log("New user, showing invite modal...");
            inviteModal.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error checking user:", error);
        // Don't alert here to avoid spamming if network is flaky on load
    }
}

// 4. Validate Logic (SessionStorage Priority)
async function validateInviteCode() {
    console.log("Validando...");

    const code = inviteCodeInput.value.trim();
    if (!code) {
        alert("Por favor, introduce un código.");
        return;
    }

    validateBtn.disabled = true;
    validateBtn.textContent = "Verificando...";
    inviteError.style.display = 'none';

    try {
        // STRATEGY: Get user from ANYWHERE (SessionStorage preferred for stability)
        let uid = sessionStorage.getItem('temp_user_uid') || auth.currentUser?.uid;
        let email = sessionStorage.getItem('temp_user_email') || auth.currentUser?.email;

        console.log("Datos para registro:", { uid, email });

        if (!uid || !email) {
            throw new Error("No se detectó la sesión. Por favor, recarga y asegúrate de iniciar sesión.");
        }

        const userObj = { uid, email };

        // HARDCODED BYPASS
        if (code.toUpperCase() === "BODA2026") {
            await registerUser(userObj, code);
            return;
        }

        // Query Code
        const q = query(collection(db, "invitation_codes"), where("code", "==", code));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            await registerUser(userObj, code);
        } else {
            showError("Código inválido o expirado.");
            resetBtn();
        }

    } catch (error) {
        console.error("Error en validación:", error);
        showError(error.message);
        resetBtn();
    }
}

async function registerUser(user, code) {
    try {
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: 'host',
            plan_storage_limit: 200,
            storage_used: 0,
            invitedByCode: code,
            createdAt: serverTimestamp()
        });

        console.log("Registro OK");
        // Clear temp storage
        sessionStorage.removeItem('temp_user_uid');
        sessionStorage.removeItem('temp_user_email');

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Error registering user:", error);
        alert("Error al guardar: " + error.message);
        resetBtn();
    }
}

function showError(msg) {
    inviteError.textContent = msg;
    inviteError.style.display = 'block';
}

function resetBtn() {
    validateBtn.disabled = false;
    validateBtn.textContent = "Validar y Entrar";
}

// Event Listeners
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.querySelectorAll('.login-trigger').forEach(btn => {
    btn.addEventListener('click', loginWithGoogle);
});
if (validateBtn) validateBtn.addEventListener('click', validateInviteCode);
inviteCodeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validateInviteCode();
});
