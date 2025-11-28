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
// ⚠️ IMPORTANTE: COLE A SUA CHAVE AQUI
const firebaseConfig = {
    // apiKey: "...",
    // authDomain: "...",
    // ...
};

// ID da aplicação para referências (pode manter 'app' se simplificou as regras)
const appId = 'app'; 

// --- 2. INICIALIZAÇÃO ---
let app, auth, db;
let currentUser = null;

try {
    // Verificação simples para evitar arranque sem chave
    if (!firebaseConfig.apiKey) {
        console.error("⚠️ Firebase Config vazia! Edite o ficheiro js/auth.js");
    } else {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("✅ Auth: Firebase inicializado.");
    }
} catch (e) {
    console.error("❌ Auth: Erro crítico na inicialização:", e);
    alert("Erro de configuração do sistema. Verifique a consola (F12).");
}

// --- 3. REFERÊNCIAS DO DOM ---
const loadingContainer = document.getElementById('loading-container');
const authContainer = document.getElementById('auth-container');
const profileSetupContainer = document.getElementById('profile-setup-container');
const appContainer = document.getElementById('app-container');

const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const profileSetupForm = document.getElementById('profile-setup-form');
const authErrorLogin = document.getElementById('auth-error-login');
const logoutButton = document.getElementById('logout-button');

// --- 4. GESTÃO DE ESTADO (Ouvinte de Autenticação) ---
if (auth) {
    onAuthStateChanged(auth, async (user) => {
        console.log("🔄 Auth: Estado alterado ->", user ? "Logado" : "Deslogado");
        
        if (user) {
            currentUser = user;
            await checkUserProfile(user);
        } else {
            currentUser = null;
            showScreen('auth');
        }
    });
}

// --- 5. NAVEGAÇÃO ENTRE TELAS ---
function showScreen(name) {
    // Oculta todas as telas
    [loadingContainer, authContainer, profileSetupContainer, appContainer].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Mostra a tela solicitada
    switch (name) {
        case 'loading':
            if (loadingContainer) loadingContainer.classList.remove('hidden');
            break;
        case 'auth':
            if (authContainer) authContainer.classList.remove('hidden');
            break;
        case 'profile-setup':
            if (profileSetupContainer) profileSetupContainer.classList.remove('hidden');
            break;
        case 'app':
            if (appContainer) appContainer.classList.remove('hidden');
            // Tenta iniciar o main.js se a função existir
            if (window.initApp) {
                window.initApp(currentUser.uid);
            } else {
                console.warn("⚠️ Auth: window.initApp não encontrado. O main.js carregou?");
            }
            break;
    }
}

// --- 6. VERIFICAÇÃO DE PERFIL ---
async function checkUserProfile(user) {
    showScreen('loading');
    
    // Caminho simplificado: users/{uid}
    // Isso evita erros de permissão em caminhos complexos
    const userDocRef = doc(db, 'users', user.uid);

    try {
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists() && docSnap.data().isComplete) {
            console.log("✅ Auth: Perfil completo encontrado.");
            updateUserDisplay(docSnap.data());
            showScreen('app');
        } else {
            console.log("📝 Auth: Perfil incompleto ou novo utilizador.");
            prefillProfileForm(user);
            showScreen('profile-setup');
        }
    } catch (error) {
        console.error("❌ Auth: Erro ao verificar perfil:", error);
        
        // Se for erro de permissão, assume que é novo utilizador para não bloquear
        if (error.code === 'permission-denied') {
             console.warn("⚠️ Auth: Permissão negada (provavelmente utilizador novo). Redirecionando para setup.");
             prefillProfileForm(user);
             showScreen('profile-setup');
        } else {
            alert("Erro de conexão ao banco de dados: " + error.message);
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
    if (emailInput) emailInput.value = user.email;
}

// --- 7. EVENTOS ---

// Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        if (authErrorLogin) authErrorLogin.classList.add('hidden');

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // Sucesso -> onAuthStateChanged trata do resto
        } catch (error) {
            console.error("Auth: Erro no login:", error.code);
            if (authErrorLogin) {
                authErrorLogin.textContent = "Email ou senha incorretos.";
                authErrorLogin.classList.remove('hidden');
            }
        }
    });
}

// Logout
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        if (auth) signOut(auth);
    });
}

// Setup de Perfil (Salvar)
if (profileSetupForm) {
    profileSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('profile-nome').value;
        const telefone = document.getElementById('profile-telefone').value;
        const nascimento = document.getElementById('profile-nascimento').value;
        const novaSenha = document.getElementById('profile-nova-senha').value;
        const errorEl = document.getElementById('profile-error');

        if (errorEl) errorEl.classList.add('hidden');

        try {
            // Atualiza senha se fornecida
            if (novaSenha && novaSenha.length >= 6) {
                await updatePassword(currentUser, novaSenha);
            }

            // Salva dados no Firestore
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                nome, 
                email: currentUser.email,
                telefone,
                dataNascimento: nascimento,
                isComplete: true,
                updatedAt: Timestamp.now()
            }, { merge: true });

            console.log("✅ Auth: Perfil salvo.");
            showScreen('app');

        } catch (error) {
            console.error("Auth: Erro ao salvar perfil:", error);
            if (errorEl) {
                errorEl.textContent = "Erro ao salvar: " + error.message;
                errorEl.classList.remove('hidden');
            }
            // Se a sessão expirou por causa da mudança de senha
            if (error.code === 'auth/requires-recent-login') {
                alert("Por favor, faça login novamente para salvar a nova senha.");
                await signOut(auth);
            }
        }
    });
}

// Botões de alternância (Login <-> Reset)
const showResetBtn = document.getElementById('show-reset-btn');
const backToLoginBtn = document.getElementById('back-to-login-btn');

if (showResetBtn) {
    showResetBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        resetForm.classList.remove('hidden');
    });
}

if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
        resetForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });
}

// Reset de Senha
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Link enviado! Verifique o seu email.");
        } catch (error) {
            alert("Erro ao enviar email: " + error.message);
        }
    });
}

// Exporta variáveis para o main.js
export { auth, db, appId };
