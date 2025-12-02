/*
 * ========================================================
 * ARQUIVO: js/auth.js (VERSÃO COM PAYWALL / PORTEIRO)
 * ========================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. CONFIGURAÇÃO (Sua chave real) ---
const firebaseConfig = {
  apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
  authDomain: "meu-planner-oab.firebaseapp.com",
  projectId: "meu-planner-oab",
  storageBucket: "meu-planner-oab.firebasestorage.app",
  messagingSenderId: "4187860413",
  appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

// --- 2. INICIALIZAÇÃO ---
let app, auth, db;
let currentUser = null;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Auth: Firebase iniciado.");
} catch (e) { console.error("Erro Firebase:", e); }

// --- 3. DOM (Mapeamento das Telas) ---
const screens = {
    loading: document.getElementById('loading-container'),
    auth: document.getElementById('auth-container'),
    profile: document.getElementById('profile-setup-container'),
    paywall: document.getElementById('paywall-container'), // Tela Nova
    app: document.getElementById('app-container')
};

// --- 4. O PORTEIRO (Lógica de Entrada) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await checkUserStatus(user);
    } else {
        currentUser = null;
        showScreen('auth');
    }
});

async function checkUserStatus(user) {
    showScreen('loading');
    
    try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 1. O perfil está completo? (Nome, etc)
            if (!data.isComplete) {
                prefillProfileForm(user);
                return showScreen('profile');
            }

            // 2. É Admin? (Passe Livre)
            if (data.isAdmin === true) {
                console.log("👑 Acesso Admin liberado.");
                updateUserDisplay(data);
                return showScreen('app');
            }

            // 3. Aluno Comum: Está Ativo?
            if (data.status === 'ativo') {
                console.log("✅ Aluno ativo. Liberando...");
                updateUserDisplay(data);
                showScreen('app');
            } else {
                // Se status for 'pendente' ou qualquer outra coisa
                console.warn("⛔ Acesso bloqueado: Pagamento pendente.");
                showScreen('paywall');
            }

        } else {
            // Usuário novo (nunca entrou no banco)
            console.log("🆕 Novo usuário detectado.");
            prefillProfileForm(user);
            showScreen('profile');
        }
    } catch (error) {
        console.error("Erro de verificação:", error);
        alert("Erro de conexão. Tente recarregar.");
        showScreen('auth');
    }
}

// Função que troca as telas (Esconde todas e mostra a escolhida)
function showScreen(name) {
    Object.values(screens).forEach(el => {
        if(el) el.classList.add('hidden');
    });
    
    if (screens[name]) {
        screens[name].classList.remove('hidden');
    }
    
    // Se for a tela do App, inicia a lógica principal
    if (name === 'app') {
        if (window.initApp) {
            window.initApp(currentUser.uid);
        } else {
            // Caso o main.js ainda não tenha carregado, tenta de novo em breve
            setTimeout(() => {
                if(window.initApp) window.initApp(currentUser.uid);
            }, 500);
        }
    }
}

function updateUserDisplay(userData) {
    const nameEl = document.getElementById('user-name-display');
    const emailEl = document.getElementById('user-email-display');
    if (nameEl) nameEl.textContent = userData.nome || 'Aluno';
    if (emailEl) emailEl.textContent = currentUser.email;
}

function prefillProfileForm(user) {
    const emailInput = document.getElementById('profile-email');
    if(emailInput) emailInput.value = user.email;
}

// --- 5. EVENTOS DE FORMULÁRIO ---

// Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const errDisplay = document.getElementById('auth-error-login');
        
        if(errDisplay) errDisplay.classList.add('hidden');

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Erro login:", error);
            if(errDisplay) {
                errDisplay.textContent = "Email ou senha incorretos.";
                errDisplay.classList.remove('hidden');
            }
        }
    });
}

// Cadastro de Perfil (Primeiro acesso)
const profileForm = document.getElementById('profile-setup-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('profile-nome').value;
        
        try {
            // Salva no banco como 'pendente' (Bloqueado até pagar)
            await setDoc(doc(db, 'users', currentUser.uid), {
                nome: nome,
                email: currentUser.email,
                isComplete: true,
                status: 'pendente', // <--- O SEGREDO DO PAYWALL ESTÁ AQUI
                createdAt: Timestamp.now(),
                // Campos iniciais para não quebrar o dashboard
                totalDiasEstudo: 0,
                sequenciaDias: 0
            }, { merge: true });
            
            // Re-checa o status (vai cair no Paywall)
            checkUserStatus(currentUser);
            
        } catch (error) { 
            alert("Erro ao salvar perfil: " + error.message); 
        }
    });
}

// Logout
const logoutBtn = document.getElementById('logout-button');
const logoutPaywall = document.getElementById('btn-logout-paywall');

const handleLogout = () => {
    signOut(auth).then(() => window.location.reload());
};

if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
if (logoutPaywall) logoutPaywall.addEventListener('click', handleLogout);

// Reset de Senha (Botões visuais)
const btnReset = document.getElementById('show-reset-btn');
const btnBack = document.getElementById('back-to-login-btn');
const formLoginDiv = document.getElementById('login-form');
const formResetDiv = document.getElementById('reset-form');

if(btnReset && formResetDiv) {
    btnReset.addEventListener('click', () => {
        formLoginDiv.classList.add('hidden');
        formResetDiv.classList.remove('hidden');
    });
}
if(btnBack && formLoginDiv) {
    btnBack.addEventListener('click', () => {
        formResetDiv.classList.add('hidden');
        formLoginDiv.classList.remove('hidden');
    });
}

export { auth, db };
