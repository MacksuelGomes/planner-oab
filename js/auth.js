import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. CONFIGURAÇÃO ---
// (MANTENHA A SUA CHAVE AQUI - NÃO VOU APAGAR A QUE VOCÊ MANDOU)
const firebaseConfig = {
  apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
  authDomain: "meu-planner-oab.firebaseapp.com",
  projectId: "meu-planner-oab",
  storageBucket: "meu-planner-oab.firebasestorage.app",
  messagingSenderId: "4187860413",
  appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

// Simplificamos o appId para evitar caminhos longos e complexos
const appId = 'app'; 

// --- 2. INICIALIZAÇÃO ---
let app, auth, db;
let currentUser = null;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Auth iniciado.");
} catch (e) {
    console.error("Erro Firebase:", e);
    alert("Erro crítico: " + e.message);
}

// --- 3. DOM ---
const loadingContainer = document.getElementById('loading-container');
const authContainer = document.getElementById('auth-container');
const profileSetupContainer = document.getElementById('profile-setup-container');
const appContainer = document.getElementById('app-container');

const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const profileSetupForm = document.getElementById('profile-setup-form');
const authErrorLogin = document.getElementById('auth-error-login');
const logoutButton = document.getElementById('logout-button');

// --- 4. ESTADO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await checkUserProfile(user);
    } else {
        currentUser = null;
        showScreen('auth');
    }
});

function showScreen(name) {
    // Esconde tudo
    [loadingContainer, authContainer, profileSetupContainer, appContainer].forEach(el => {
        if(el) el.classList.add('hidden');
    });
    
    // Mostra o alvo
    if (name === 'loading') loadingContainer?.classList.remove('hidden');
    if (name === 'auth') authContainer?.classList.remove('hidden');
    if (name === 'profile-setup') profileSetupContainer?.classList.remove('hidden');
    if (name === 'app') {
        appContainer?.classList.remove('hidden');
        if (window.initApp) window.initApp(currentUser.uid);
    }
}

// --- 5. PERFIL (SIMPLIFICADO) ---
async function checkUserProfile(user) {
    showScreen('loading');
    
    // CAMINHO SIMPLIFICADO: Direto em /users/{uid}
    // Isso evita erros com "artifacts/default-app-id/..."
    const userDocRef = doc(db, 'users', user.uid);

    try {
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists() && docSnap.data().isComplete) {
            updateUserDisplay(docSnap.data());
            showScreen('app');
        } else {
            console.log("Perfil novo. Setup.");
            prefillProfileForm(user);
            showScreen('profile-setup');
        }
    } catch (error) {
        console.error("Erro perfil:", error);
        // Se der erro de permissão, assume que é novo usuário para não travar
        // (O setup vai tentar criar o doc depois)
        if (error.code === 'permission-denied') {
             alert("Erro de permissão. Verifique as Regras no Console do Firebase.");
        }
        showScreen('auth');
    }
}

function updateUserDisplay(userData) {
    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = userData.nome || 'Aluno';
}

function prefillProfileForm(user) {
    const emailInput = document.getElementById('profile-email');
    if(emailInput) emailInput.value = user.email;
}

// --- 6. EVENTOS ---

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        if(authErrorLogin) authErrorLogin.classList.add('hidden');

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error(error);
            if(authErrorLogin) {
                authErrorLogin.textContent = "Erro no login. Verifique a senha.";
                authErrorLogin.classList.remove('hidden');
            }
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => signOut(auth));
}

if (profileSetupForm) {
    profileSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('profile-nome').value;
        
        try {
            // Salva direto em /users/{uid}
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                nome, 
                email: currentUser.email,
                isComplete: true,
                createdAt: Timestamp.now()
            }, { merge: true });

            showScreen('app');
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar perfil: " + error.message);
        }
    });
}

// Botões de alternância
document.getElementById('show-reset-btn')?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
});
document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
    resetForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

export { auth, db, appId };
