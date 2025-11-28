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

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
// 🔴 IMPORTANTE: VOCÊ TEM DE COLAR A SUA CHAVE AQUI 🔴
// Substitua todo o objeto abaixo pela chave que copiou do Console do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
  authDomain: "meu-planner-oab.firebaseapp.com",
  projectId: "meu-planner-oab",
  storageBucket: "meu-planner-oab.firebasestorage.app",
  messagingSenderId: "4187860413",
  appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 2. INICIALIZAÇÃO SEGURA ---
let app, auth, db;
let currentUser = null;
let isInitialized = false;

try {
    // Verificação de segurança antes de iniciar
    if (!firebaseConfig.apiKey) {
        throw new Error("Chave de API não encontrada. Edite o ficheiro js/auth.js e cole a sua configuração.");
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isInitialized = true;
    console.log("✅ Firebase Auth inicializado com sucesso.");
} catch (e) {
    console.error("❌ ERRO CRÍTICO DO FIREBASE:", e);
    // Mostra erro visual para o utilizador não ficar "às escuras"
    setTimeout(() => {
        alert("Erro de Configuração do Sistema:\n" + e.message);
    }, 1000);
}

// --- 3. REFERÊNCIAS DO DOM ---
const loadingContainer = document.getElementById('loading-container');
const authContainer = document.getElementById('auth-container');
const profileSetupContainer = document.getElementById('profile-setup-container');
const appContainer = document.getElementById('app-container');

// Formulários
const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const profileSetupForm = document.getElementById('profile-setup-form');

// Botões e Displays
const showResetBtn = document.getElementById('show-reset-btn');
const backToLoginBtn = document.getElementById('back-to-login-btn');
const logoutButton = document.getElementById('logout-button');
const authErrorLogin = document.getElementById('auth-error-login');

// --- 4. GESTÃO DE ESTADO ---
// Só ativamos o ouvinte se o Firebase iniciou corretamente
if (isInitialized && auth) {
    onAuthStateChanged(auth, async (user) => {
        console.log("🔄 Estado de Autenticação:", user ? "Logado" : "Deslogado");
        
        if (user) {
            currentUser = user;
            await checkUserProfile(user);
        } else {
            currentUser = null;
            showScreen('auth');
        }
    });
} else {
    // Se falhou a inicialização, removemos o loader para permitir ver o erro
    if(loadingContainer) loadingContainer.classList.add('hidden');
}

// --- 5. NAVEGAÇÃO ---
function showScreen(screenName) {
    // Esconde tudo
    [loadingContainer, authContainer, profileSetupContainer, appContainer].forEach(el => {
        if(el) el.classList.add('hidden');
    });

    // Mostra o desejado
    switch (screenName) {
        case 'loading':
            if(loadingContainer) loadingContainer.classList.remove('hidden');
            break;
        case 'auth':
            if(authContainer) authContainer.classList.remove('hidden');
            break;
        case 'profile-setup':
            if(profileSetupContainer) profileSetupContainer.classList.remove('hidden');
            break;
        case 'app':
            if(appContainer) appContainer.classList.remove('hidden');
            if (window.initApp && currentUser) window.initApp(currentUser.uid);
            break;
    }
}

// --- 6. PERFIL ---
async function checkUserProfile(user) {
    showScreen('loading');
    // Caminho: /artifacts/{appId}/users/{userId}
    const userDocRef = doc(db, `artifacts/${appId}/users`, user.uid);

    try {
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists() && docSnap.data().isComplete) {
            updateUserDisplay(docSnap.data());
            showScreen('app');
        } else {
            console.log("📝 Perfil incompleto. A iniciar setup.");
            prefillProfileForm(user, docSnap.exists() ? docSnap.data() : null);
            showScreen('profile-setup');
        }
    } catch (error) {
        console.error("❌ Erro ao ler perfil:", error);
        alert("Erro de conexão com o banco de dados. Verifique as regras do Firestore.");
        showScreen('auth');
    }
}

function updateUserDisplay(userData) {
    const nameEl = document.getElementById('user-name-display');
    const emailEl = document.getElementById('user-email-display');
    if (nameEl) nameEl.textContent = userData.nome || 'Aluno';
    if (emailEl) emailEl.textContent = userData.email || currentUser.email;
}

function prefillProfileForm(user, data) {
    const emailInput = document.getElementById('profile-email');
    if(emailInput) emailInput.value = user.email;
    if (data) {
        if (data.nome) document.getElementById('profile-nome').value = data.nome;
        if (data.telefone) document.getElementById('profile-telefone').value = data.telefone;
        if (data.dataNascimento) document.getElementById('profile-nascimento').value = data.dataNascimento;
    }
}

// --- 7. EVENTOS (LOGIN, ETC) ---

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isInitialized) return alert("Sistema não configurado (Falta chave API).");

        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        if(authErrorLogin) authErrorLogin.classList.add('hidden');
        
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // Sucesso -> O onAuthStateChanged trata do resto
        } catch (error) {
            console.error("Erro login:", error.code);
            if(authErrorLogin) {
                authErrorLogin.textContent = "Email ou senha incorretos.";
                authErrorLogin.classList.remove('hidden');
            }
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        if(auth) signOut(auth);
    });
}

if (profileSetupForm) {
    profileSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('profile-error');
        if(errorEl) errorEl.classList.add('hidden');
        
        const nome = document.getElementById('profile-nome').value;
        const telefone = document.getElementById('profile-telefone').value;
        const nascimento = document.getElementById('profile-nascimento').value;
        const novaSenha = document.getElementById('profile-nova-senha').value;

        if (!nome) return alert("Preencha o nome.");

        try {
            if (novaSenha && novaSenha.length >= 6) {
                await updatePassword(currentUser, novaSenha);
            }

            const userDocRef = doc(db, `artifacts/${appId}/users`, currentUser.uid);
            await setDoc(userDocRef, {
                nome, email: currentUser.email, telefone, dataNascimento: nascimento,
                isComplete: true, updatedAt: Timestamp.now()
            }, { merge: true });

            showScreen('app');

        } catch (error) {
            console.error("Erro salvar perfil:", error);
            if(errorEl) {
                errorEl.textContent = "Erro: " + error.message;
                errorEl.classList.remove('hidden');
            }
            if (error.code === 'auth/requires-recent-login') await signOut(auth);
        }
    });
}

// Navegação Login/Reset
if (showResetBtn) showResetBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
    document.getElementById('auth-forms-title').textContent = "Redefinir Senha";
});

if (backToLoginBtn) backToLoginBtn.addEventListener('click', () => {
    resetForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    document.getElementById('auth-forms-title').textContent = "Bem-vindo de volta";
});

if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Link enviado! Verifique o seu email.");
        } catch (error) {
            alert("Erro ao enviar email.");
        }
    });
}

export { auth, db, appId };
