/*
 * ========================================================
 * FICHEIRO: js/firebase-config.js
 * (Esta é a base correta)
 * ========================================================
 */


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// A sua configuração
const firebaseConfig = {
    apiKey: "AIzaSyBPMeD3N3vIuK6zf0GCdDvON-gQkv_CBQk",
    authDomain: "meu-planner-oab.firebaseapp.com",
    projectId: "meu-planner-oab",
    storageBucket: "meu-planner-oab.firebasestorage.app",
    messagingSenderId: "4187860413",
    appId: "1:4187860413:web:b61239f784aaf5ed06f6d4"
};

// Inicializa e exporta tudo
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
