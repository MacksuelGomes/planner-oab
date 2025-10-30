/*
 * ========================================================
 * ARQUIVO: js/main.js
 * O CÉREBRO DO APLICATIVO (DASHBOARD E LÓGICA)
 *
 * NOVA VERSÃO: Agora com Gestor de Conteúdo (Upload)
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
// Importa os serviços (auth, db) E o novo (storage)
import { auth, db, storage } from './auth.js'; 

// Importa funções do Firebase que vamos usar aqui
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// --- NOVO: IMPORTAR FUNÇÕES DO STORAGE ---
import { 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


// --- [ PARTE 2: SELETORES DO DOM ] ---
const appContent = document.getElementById('app-content');
let currentUserData = null; // Vamos guardar os dados do utilizador aqui

// --- [ PARTE 3: LISTENER DE AUTENTICAÇÃO ] ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboard(user);
    } else {
        appContent.innerHTML = '';
        currentUserData = null;
    }
});

// --- [ PARTE 4: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
async function loadDashboard(user) {
    try {
        appContent.innerHTML = renderLoadingState();
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserData = userDoc.data(); // Guarda os dados do utilizador
            
            if (currentUserData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(currentUserData);
            } else {
                appContent.innerHTML = renderStudentDashboard(currentUserData);
            }
        } else {
            appContent.innerHTML = `<p>Erro: Perfil não encontrado.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        appContent.innerHTML = `<p>Ocorreu um erro ao carregar seus dados.</p>`;
    }
}

// --- [ NOVO: PARTE 5 - GESTORES DE CLIQUE DO DASHBOARD ] ---
// Usamos delegação de eventos no contentor principal
appContent.addEventListener('click', (e) => {
    // Se clicar no botão de Gerir Questões (Admin)
    if (e.target.id === 'admin-gerir-questoes') {
        appContent.innerHTML = renderAdminUpload(currentUserData);
    }
    
    // Se clicar no botão "Voltar" (do ecrã de Upload)
    if (e.target.id === 'admin-voltar-dash') {
        appContent.innerHTML = renderAdminDashboard(currentUserData);
    }
    
    // Se clicar no botão "Subir Ficheiro"
    if (e.target.id === 'admin-submit-upload') {
        handleFileUpload();
    }
});

// --- [ NOVO: PARTE 6 - LÓGICA DE UPLOAD ] ---
function handleFileUpload() {
    const fileInput = document.getElementById('admin-file-input');
    const file = fileInput.files[0];
    const statusEl = document.getElementById('upload-status');
    const progressEl = document.getElementById('upload-progress');

    if (!file) {
        statusEl.textContent = "Por favor, selecione um ficheiro .json.";
        statusEl.className = "text-red-400";
        return;
    }

    // Só permite ficheiros .json
    if (file.type !== "application/json") {
        statusEl.textContent = "Erro: O ficheiro tem de ser .json.";
        statusEl.className = "text-red-400";
        return;
    }

    // 1. Criar a referência no Storage
    // Ex: banco-questoes/etica.json
    const storageRef = ref(storage, `banco-questoes/${file.name}`);
    
    // 2. Iniciar o upload
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    statusEl.textContent = "A subir...";
    statusEl.className = "text-blue-400";
    progressEl.style.width = "0%";
    progressEl.classList.remove('hidden');

    // 3. Monitorizar o progresso
    uploadTask.on('state_changed', 
        (snapshot) => {
            // Progresso
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressEl.style.width = progress + "%";
        }, 
        (error) => {
            // Erro
            console.error("Erro no upload:", error);
            statusEl.textContent = "Erro no upload. (Verifique as Regras do Storage!)";
            statusEl.className = "text-red-400";
        }, 
        () => {
            // Sucesso
            statusEl.textContent = `Ficheiro "${file.name}" subido com sucesso!`;
            statusEl.className = "text-green-400";
            fileInput.value = ''; // Limpa o input
            
            // Opcional: Mostrar o link de download (para teste)
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('Ficheiro disponível em:', downloadURL);
            });
        }
    );
}


// --- [ PARTE 7: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---
const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";

function renderLoadingState() {
    return `<p class="text-gray-400">A carregar os seus dados...</p>`;
}

// --- NOVO: ECRÃ DE UPLOAD DO ADMIN ---
function renderAdminUpload(userData) {
    return `
        <button id="admin-voltar-dash" 
                class="mb-4 text-blue-400 hover:text-blue-300">
            &larr; Voltar ao Painel
        </button>
    
        <h1 class="text-3xl font-bold text-white mb-6">
            Gestor do Banco de Questões
        </h1>
        
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-4">
                Subir novo ficheiro de questões (.json)
            </h2>
            
            <p class="text-gray-300 mb-4">
                Selecione o ficheiro .json (ex: "etica.json") do seu computador. 
                Se subir um ficheiro com um nome que já existe, ele será 
                <strong class="text-yellow-400">sobrescrito</strong>.
            </p>
            
            <input type="file" id="admin-file-input" 
                   class="w-full text-gray-300 file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0 file:text-sm file:font-semibold
                          file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                   accept=".json">
            
            <div class="w-full bg-gray-700 rounded-full h-2.5 mt-4 hidden">
                <div id="upload-progress" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
            
            <p id="upload-status" class="text-center mt-4"></p>
            
            <button id="admin-submit-upload" 
                    class="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded hover:bg-green-700 transition mt-6">
                Subir Ficheiro
            </button>
        </div>
    `;
}

// --- PAINEL DO ADMINISTRADOR ---
function renderAdminDashboard(userData) {
    return `
        <h1 class="text-3xl font-bold text-white mb-2">Painel Administrativo</h1>
        <p class="text-lg text-blue-400 mb-8">Bem-vindo, Admin ${userData.nome}!</p>
        
        <div class="grid md:grid-cols-2 gap-6">
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">Gestão de Conteúdo</h2>
                <p class="text-gray-300 mb-4">Adicionar, editar ou remover questões do banco de dados.</p>
                <button id="admin-gerir-questoes" 
                        class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition">
                    Gerir Banco de Questões
                </button>
            </div>
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">Gestão de Alunos</h2>
                <p class="text-gray-300 mb-4">Ver alunos, criar acessos e gerir senhas.</p>
                <a href="https://console.firebase.google.com/project/meu-planner-oab/authentication/users" 
                   target="_blank" 
                   class="block w-full text-center bg-gray-600 text-white font-semibold py-2 px-4 rounded hover:bg-gray-700 transition">
                    Aceder Painel do Firebase
                </a>
            </div>
        </div>
    `;
}

// --- PAINEL DO ALUNO ---
function renderStudentDashboard(userData) {
    return `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="${cardStyle}">
                <h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3>
                <p class="text-3xl font-bold text-white mt-2">0</p>
            </div>
            <div class="${cardStyle}">
                <h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3>
                <p class="text-3xl font-bold text-white mt-2">0%</p>
            </div>
            <div class="${cardStyle}">
                <h3 class="text-sm font-medium text-gray-400 uppercase">Dias de Estudo</h3>
                <p class="text-3xl font-bold text-white mt-2">0</p>
            </div>
        </div>
        
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-4">Ciclo de Estudos (Método Reverso)</h2>
            <p class="text-gray-300">
                (Em breve) Aqui é onde a lógica principal do seu planner será implementada.
            </p>
        </div>
    `;
}
