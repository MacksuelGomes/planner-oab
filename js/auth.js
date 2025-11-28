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
const firebaseConfig = {
apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
authDomain: "meu-planner-oab.firebaseapp.com",
projectId: "meu-planner-oab",
storageBucket: "meu-planner-oab.firebasestorage.app",
messagingSenderId: "4187860413",
appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

const appId = 'app';

// --- 2. INICIALIZAÇÃO ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Helper opcional: se algum outro arquivo quiser esperar o usuário
export function waitForUser() {
return new Promise((resolve, reject) => {
const unsub = onAuthStateChanged(auth, (user) => {
unsub();
if (user) resolve(user);
else reject(new Error('Usuário não autenticado'));
});
});
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
await checkUserProfile(user);
} else {
currentUser = null;
showScreen('auth');
}
});

function showScreen(name) {
console.log("📱 Mostrar tela:", name);
