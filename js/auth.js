import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
// ⚠️ SUBSTITUA ESTE BLOCO PELA SUA CHAVE REAL DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
  authDomain: "meu-planner-oab.firebaseapp.com",
  projectId: "meu-planner-oab",
  storageBucket: "meu-planner-oab.firebasestorage.app",
  messagingSenderId: "4187860413",
  appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 2. INICIALIZAÇÃO ---
let app, auth, db;
let currentUser = null;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Firebase Auth inicializado.");
} catch (e) {
    console.error("❌ Erro ao inicializar Firebase:", e);
    alert("Erro de configuração. Verifique a consola.");
}

// --- 3. REFERÊNCIAS DO DOM (Elementos HTML) ---
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

// --- 4. GESTÃO DE ESTADO (Ouvinte de Login) ---
onAuthStateChanged(auth, async (user) => {
    console.log("🔄 Estado de Autenticação alterado:", user ? "Logado" : "Deslogado");
    
    if (user) {
        // Utilizador está logado
        currentUser = user;
        await checkUserProfile(user);
    } else {
        // Utilizador não está logado
        currentUser = null;
        showScreen('auth'); // Mostra tela de login
    }
});

// --- 5. FUNÇÕES DE NAVEGAÇÃO ENTRE TELAS ---
function showScreen(screenName) {
    console.log("📱 A mostrar tela:", screenName);
    
    // Esconde tudo primeiro
    if(loadingContainer) loadingContainer.classList.add('hidden');
    if(authContainer) authContainer.classList.add('hidden');
    if(profileSetupContainer) profileSetupContainer.classList.add('hidden');
    if(appContainer) appContainer.classList.add('hidden');

    // Mostra a tela desejada
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
            // Inicia a lógica do app principal (se existir)
            console.log("🔗 Tentando iniciar app principal...");
            if (window.initApp) {
                window.initApp(currentUser.uid); 
            } else {
                console.error("❌ Função window.initApp não encontrada! O main.js foi carregado?");
            }
            break;
    }
}

// --- 6. VERIFICAÇÃO DE PERFIL (Correção do Bug das 5 partes) ---
async function checkUserProfile(user) {
    showScreen('loading'); // Mostra a bolinha enquanto verifica

    // CAMINHO CORRIGIDO: /artifacts/{appId}/users/{userId} (4 partes)
    const userDocRef = doc(db, `artifacts/${appId}/users`, user.uid);

    try {
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists() && docSnap.data().isComplete) {
            // Perfil completo -> Vai para o App
            console.log("✅ Perfil completo. Acedendo ao App.");
            updateUserDisplay(docSnap.data());
            showScreen('app');
        } else {
            // Perfil incompleto -> Vai para o Setup
            console.log("📝 Perfil incompleto ou inexistente. Redirecionando para setup.");
            prefillProfileForm(user, docSnap.exists() ? docSnap.data() : null);
            showScreen('profile-setup');
        }
    } catch (error) {
        console.error("❌ Erro ao verificar perfil:", error);
        alert("Erro ao carregar perfil: " + error.message);
        // showScreen('auth'); // Comentado para permitir depuração se falhar
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

// --- 7. EVENTOS DE FORMULÁRIO ---

// LOGIN
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("🔑 Tentativa de login...");
        
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        if(authErrorLogin) authErrorLogin.classList.add('hidden');
        
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            console.log("✅ Login efetuado com sucesso (aguardando onAuthStateChanged)");
        } catch (error) {
            console.error("❌ Erro no login:", error.code, error.message);
            if(authErrorLogin) {
                authErrorLogin.textContent = "Email ou senha incorretos.";
                authErrorLogin.classList.remove('hidden');
            }
        }
    });
}

// LOGOUT
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        console.log("👋 A sair...");
        signOut(auth);
    });
}

// PROFILE SETUP (Salvar Perfil)
if (profileSetupForm) {
    profileSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('profile-error');
        if(errorEl) errorEl.classList.add('hidden');
        
        const nome = document.getElementById('profile-nome').value;
        const telefone = document.getElementById('profile-telefone').value;
        const nascimento = document.getElementById('profile-nascimento').value;
        const novaSenha = document.getElementById('profile-nova-senha').value;

        if (!nome) {
            if(errorEl) {
                errorEl.textContent = "O nome é obrigatório.";
                errorEl.classList.remove('hidden');
            }
            return;
        }

        try {
            // 1. Se tiver nova senha, atualiza
            if (novaSenha && novaSenha.length >= 6) {
                await updatePassword(currentUser, novaSenha);
            }

            // 2. Salva no Firestore (Caminho Corrigido)
            const userDocRef = doc(db, `artifacts/${appId}/users`, currentUser.uid);
            await setDoc(userDocRef, {
                nome: nome,
                email: currentUser.email,
                telefone: telefone,
                dataNascimento: nascimento,
                isComplete: true, // Marca como completo
                updatedAt: Timestamp.now()
            }, { merge: true });

            console.log("✅ Perfil salvo com sucesso.");
            // 3. Redireciona
            showScreen('app');

        } catch (error) {
            console.error("❌ Erro ao salvar perfil:", error);
            if(errorEl) {
                errorEl.textContent = "Erro ao salvar: " + error.message;
                errorEl.classList.remove('hidden');
            }
            
            if (error.code === 'auth/requires-recent-login') {
                await signOut(auth);
            }
        }
    });
}

// Alternar entre Login e Reset de Senha
if (showResetBtn) {
    showResetBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        resetForm.classList.remove('hidden');
        document.getElementById('auth-forms-title').textContent = "Redefinir Senha";
    });
}

if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
        resetForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        document.getElementById('auth-forms-title').textContent = "Bem-vindo de volta";
    });
}

// Lógica de envio de email de reset
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const successMsg = document.getElementById('auth-success-reset');
        const errorMsg = document.getElementById('auth-error-reset');
        
        if(successMsg) successMsg.classList.add('hidden');
        if(errorMsg) errorMsg.classList.add('hidden');

        try {
            await sendPasswordResetEmail(auth, email);
            if(successMsg) {
                successMsg.textContent = "Link enviado! Verifique o seu email.";
                successMsg.classList.remove('hidden');
            }
        } catch (error) {
            if(errorMsg) {
                errorMsg.textContent = "Erro ao enviar. Verifique o email.";
                errorMsg.classList.remove('hidden');
            }
        }
    });
}

// Exporta variáveis úteis para outros módulos (como main.js)
export { auth, db, appId };
