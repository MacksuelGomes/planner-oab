/*
 * ========================================================
 * ARQUIVO: js/auth.js (VERSÃO 2.1 - Correção de Conflito)
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS DO FIREBASE ] ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getStorage 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
// (NOVO) Importar a função de desenhar o dashboard
import { loadDashboard } from './main.js'; 


// --- [ PARTE 2: CONFIGURAÇÃO DO FIREBASE ] ---
const firebaseConfig = {
    apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
    authDomain: "meu-planner-oab.firebaseapp.com",
    projectId: "meu-planner-oab",
    storageBucket: "meu-planner-oab.firebasestorage.app",
    messagingSenderId: "4187860413",
    appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

// --- [ PARTE 3: INICIAR O FIREBASE E EXPORTAR SERVIÇOS ] ---
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 

// --- [ PARTE 4: SELETORES DO DOM (OS NOSSOS ECRÃS) ] ---
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

const logoutButton = document.getElementById('logout-button');
const userEmailElement = document.getElementById('user-email');

// --- [ PARTE 5: GESTOR DE ECRÃS ] ---
function showScreen(screenId) {
    loadingScreen.style.display = 'none';
    authScreen.style.display = 'none';
    appScreen.style.display = 'none';

    if (screenId === 'loading') {
        loadingScreen.style.display = 'flex';
    } else if (screenId === 'auth') {
        authScreen.style.display = 'flex';
    } else if (screenId === 'app') {
        appScreen.style.display = 'block';
    }
}

// --- [ PARTE 6: O "PORTEIRO" (LISTENER DE AUTENTICAÇÃO) ] ---
onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                userEmailElement.textContent = user.email;
                showScreen('app'); // 1. Mostra o ecrã da app
                loadDashboard(user); // 2. (NOVO) Chama o main.js para desenhar o conteúdo
            } else {
                authScreen.innerHTML = renderProfileForm(user);
                showScreen('auth');
            }
        } else {
            authScreen.innerHTML = renderLoginForm();
            showScreen('auth');
        }
    } catch (error) {
        console.error("Erro no onAuthStateChanged:", error);
        authScreen.innerHTML = renderLoginForm(error.message);
        showScreen('auth');
    }
});

// --- [ PARTE 7: GESTORES DE EVENTOS (CLICKS E SUBMISSÕES) ] ---
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});

authScreen.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'show-register') {
        authScreen.innerHTML = renderRegisterForm();
    }
    if (e.target.dataset.action === 'show-login') {
        authScreen.innerHTML = renderLoginForm();
    }
    if (e.target.dataset.action === 'show-reset') {
        authScreen.innerHTML = renderResetPasswordForm();
    }
});

authScreen.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const messageEl = e.target.querySelector('#auth-message');
    
    // --- [ AÇÃO: LOGIN ] ---
    if (e.target.id === 'form-login') {
        const email = e.target.email.value;
        const password = e.target.password.value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            messageEl.textContent = "Email ou senha inválidos.";
        }
    }

    // --- [ AÇÃO: REGISTO ] ---
    if (e.target.id === 'form-register') {
        const email = e.target.email.value;
        const password = e.target.password.value;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            messageEl.textContent = "Erro ao criar conta. Tente outro e-mail.";
        }
    }

    // --- [ AÇÃO: COMPLETAR PERFIL ] ---
    if (e.target.id === 'form-profile') {
        const nome = e.target.nome.value;
        const user = auth.currentUser;
        if (!user || !nome) {
            messageEl.textContent = "Precisa de preencher o nome.";
            return;
        }
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                nome: nome,
                email: user.email,
                criadoEm: new Date()
            });
        } catch (error) {
            messageEl.textContent = "Erro ao guardar o perfil.";
        }
    }
    
    // --- [ AÇÃO: RESET DE SENHA ] ---
    if (e.target.id === 'form-reset') {
        const email = e.target.email.value;
        try {
            await sendPasswordResetEmail(auth, email);
            messageEl.textContent = "Link de recuperação enviado para o seu e-mail.";
        } catch (error) {
            messageEl.textContent = "Erro ao enviar e-mail de recuperação.";
        }
    }
});


// --- [ PARTE 8: FUNÇÕES DE RENDERIZAÇÃO (HTML DOS FORMULÁRIOS) ] ---
function renderLoginForm(errorMsg = "") {
    return `
        <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 class="text-3xl font-bold text-center text-white">Aceder à Plataforma</h2>
            <form id="form-login" class="space-y-6">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
                    <input type="email" id="email" name="email" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-300">Senha</label>
                    <input type="password" id="password" name="password" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div id="auth-message" class="text-red-400 text-sm">${errorMsg}</div>
                <div>
                    <button type="submit" 
                            class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Entrar
                    </button>
                </div>
            </form>
            <div class="text-sm text-center">
                <a href="#" data-action="show-reset" class="font-medium text-blue-400 hover:text-blue-300">Esqueceu a senha?</a>
            </div>
            
            <div class="text-sm text-center text-gray-400 mt-6 border-t border-gray-700 pt-4">
                <a href="index.html" class="font-medium text-blue-400 hover:text-blue-300">
                    &larr; Voltar à página inicial
                </a>
            </div>
        </div>
    `;
}

function renderRegisterForm(errorMsg = "") {
    return `
        <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 class="text-3xl font-bold text-center text-white">Criar Conta</h2>
            <form id="form-register" class="space-y-6">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-300">Email</o>
                    <input type="email" id="email" name="email" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-300">Senha</label>
                    <input type="password" id="password" name="password" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div id="auth-message" class="text-red-400 text-sm">${errorMsg}</div>
                <div>
                    <button type="submit" 
                            class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Registar
                    </button>
                </div>
            </form>
            <div class="text-sm text-center text-gray-400">
                Já tem conta? 
                <a href="#" data-action="show-login" class="font-medium text-blue-400 hover:text-blue-300">Faça login</a>
            </div>

            <div class="text-sm text-center text-gray-400 mt-6 border-t border-gray-700 pt-4">
                <a href="index.html" class="font-medium text-blue-400 hover:text-blue-300">
                    &larr; Voltar à página inicial
                </a>
            </div>
        </div>
    `;
}

function renderProfileForm(user, errorMsg = "") {
    return `
        <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 class="text-3xl font-bold text-center text-white">Quase lá!</h2>
            <p class="text-center text-gray-300">
                Bem-vindo(a), ${user.email}.<br>
                Por favor, complete o seu perfil para continuar.
            </p>
            <form id="form-profile" class="space-y-6">
                <div>
                    <label for="nome" class="block text-sm font-medium text-gray-300">Nome Completo</label>
                    <input type="text" id="nome" name="nome" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div id="auth-message" class="text-red-400 text-sm">${errorMsg}</div>
                <div>
                    <button type="submit" 
                            class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Guardar e Aceder
                    </button>
                </div>
            </form>
        </div>
    `;
}

function renderResetPasswordForm(errorMsg = "") {
    return `
        <div class="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 class="text-3xl font-bold text-center text-white">Recuperar Senha</h2>
            <form id="form-reset" class="space-y-6">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
                    <input type="email" id="email" name="email" required 
                            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div id="auth-message" class="text-red-400 text-sm">${errorMsg}</div>
                <div>
                    <button type="submit" 
                            class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Enviar Link
                    </button>
                </div>
            </form>
            <div class="text-sm text-center text-gray-400">
                Lembrou-se da senha? 
                <a href="#" data-action="show-login" class="font-medium text-blue-400 hover:text-blue-300">Faça login</a>
            </div>

            <div class="text-sm text-center text-gray-400 mt-6 border-t border-gray-700 pt-4">
                <a href="index.html" class="font-medium text-blue-400 hover:text-blue-300">
                    &larr; Voltar à página inicial
                </a>
            </div>
        </div>
    `;
}
