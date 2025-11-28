/*
 * ========================================================
 * ARQUIVO: js/auth.js (VERSÃO FINAL RESTAURADA)
 * ========================================================
 */

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

// IMPORTAÇÃO DIRETA DO MAIN.JS 
// (Garante que o window.initApp existe antes de tentarmos usá-lo)
import './main.js';

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
// 🔴 COLE A SUA CHAVE AQUI 🔴
const firebaseConfig = {
  apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
  authDomain: "meu-planner-oab.firebaseapp.com",
  projectId: "meu-planner-oab",
  storageBucket: "meu-planner-oab.firebasestorage.app",
  messagingSenderId: "4187860413",
  appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

export const appId = 'app'; 

// --- 2. INICIALIZAÇÃO ---
let app, auth, db;
let currentUser = null;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Auth: Firebase iniciado com sucesso.");
} catch (e) {
    console.error("Erro Firebase:", e);
    alert("Erro crítico de configuração: " + e.message);
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
    console.log("🔄 Estado Auth:", user ? "Logado" : "Deslogado");
    if (user) {
        currentUser = user;
        // Pequeno delay para garantir que o DOM e main.js estão prontos
        setTimeout(() => checkUserProfile(user), 100);
    } else {
        currentUser = null;
        showScreen('auth');
    }
});

function showScreen(name) {
    // Esconde tudo
    if(loadingContainer) loadingContainer.classList.add('hidden');
    if(authContainer) authContainer.classList.add('hidden');
    if(profileSetupContainer) profileSetupContainer.classList.add('hidden');
    if(appContainer) appContainer.classList.add('hidden');
    
    // Mostra o alvo
    if (name === 'loading' && loadingContainer) loadingContainer.classList.remove('hidden');
    if (name === 'auth' && authContainer) authContainer.classList.remove('hidden');
    if (name === 'profile-setup' && profileSetupContainer) profileSetupContainer.classList.remove('hidden');
    
    if (name === 'app') {
        if(appContainer) appContainer.classList.remove('hidden');
        
        // Tenta iniciar a aplicação principal
        if (window.initApp) {
            window.initApp(currentUser.uid);
        } else {
            console.error("❌ window.initApp não encontrado! Tentando recarregar...");
            // Fallback de segurança
            setTimeout(() => {
                if (window.initApp) window.initApp(currentUser.uid);
                else alert("Erro: A aplicação não carregou corretamente. Recarregue a página.");
            }, 1000);
        }
    }
}

// --- 5. PERFIL ---
async function checkUserProfile(user) {
    showScreen('loading');
    
    // CAMINHO SIMPLIFICADO: users/{uid}
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
        // Se der erro de permissão ou rede, tenta mostrar o app de qualquer jeito se o utilizador já estiver logado
        if (currentUser) {
             console.warn("Erro ao ler perfil, mas user está logado. Forçando entrada.");
             showScreen('app');
        } else {
             alert("Erro de banco de dados: " + error.message);
             showScreen('auth');
        }
    }
}

function updateUserDisplay(userData) {
    const nameEl = document.getElementById('user-name-display');
    const emailEl = document.getElementById('user-email-display');
    if (nameEl) nameEl.textContent = userData.nome || 'Aluno';
    if (emailEl && currentUser) emailEl.textContent = currentUser.email;
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
            console.error("Erro login:", error);
            if(authErrorLogin) {
                authErrorLogin.textContent = "Email ou senha incorretos.";
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
            alert("Erro salvar perfil: " + error.message);
        }
    });
}

// Botões de alternância
const btnReset = document.getElementById('show-reset-btn');
const btnBack = document.getElementById('back-to-login-btn');

if (btnReset) {
    btnReset.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        resetForm.classList.remove('hidden');
    });
}

if (btnBack) {
    btnBack.addEventListener('click', () => {
        resetForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });
}

export { auth, db, appId };
