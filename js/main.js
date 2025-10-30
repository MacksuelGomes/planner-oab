/*
 * ========================================================
 * ARQUIVO: js/main.js
 * O CÉREBRO DO APLICATIVO (DASHBOARD E LÓGICA)
 *
 * NOVA VERSÃO: Agora com distinção de ADMIN
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
// Importa os serviços (auth, db) que o auth.js já iniciou
import { auth, db } from './auth.js'; 

// Importa funções do Firebase que vamos usar aqui
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- [ PARTE 2: SELETORES DO DOM ] ---
// Onde o conteúdo principal do app será desenhado
const appContent = document.getElementById('app-content');

// --- [ PARTE 3: LISTENER DE AUTENTICAÇÃO ] ---
// Este listener "ouve" o auth.js. 
// Quando o auth.js diz "utilizador logado e perfil completo", este é ativado.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Utilizador está logado e verificado pelo auth.js
        // Vamos carregar o dashboard dele
        loadDashboard(user);
    } else {
        // Utilizador fez logout
        // Limpa o conteúdo do app
        appContent.innerHTML = '';
    }
});

// --- [ PARTE 4: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
async function loadDashboard(user) {
    try {
        // 1. Informa ao utilizador que estamos a carregar os dados
        appContent.innerHTML = renderLoadingState();
        
        // 2. Busca os dados do perfil (ex: nome e isAdmin) no Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // ===============================================
            // AQUI ESTÁ A MÁGICA: A VERIFICAÇÃO DE ADMIN
            // ===============================================
            if (userData.isAdmin === true) {
                // Se o campo 'isAdmin' for verdadeiro
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                // Para todos os outros alunos normais
                appContent.innerHTML = renderStudentDashboard(userData);
            }
            // ===============================================
            
        } else {
            // Isto é uma segurança extra, mas o auth.js já deve ter tratado disto
            appContent.innerHTML = `<p>Erro: Perfil não encontrado.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        appContent.innerHTML = `<p>Ocorreu um erro ao carregar seus dados.</p>`;
    }
}

// --- [ PARTE 5: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---

// Desenha o estado de "a carregar..."
function renderLoadingState() {
    return `<p class="text-gray-400">A carregar os seus dados...</p>`;
}

// ------ NOVO: PAINEL DO ADMINISTRADOR ------
function renderAdminDashboard(userData) {
    // Classes do Tailwind para os "cards"
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    
    return `
        <h1 class="text-3xl font-bold text-white mb-2">
            Painel Administrativo
        </h1>
        <p class="text-lg text-blue-400 mb-8">
            Bem-vindo, Admin ${userData.nome}!
        </p>

        <div class="grid md:grid-cols-2 gap-6">
            
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">
                    Gestão de Conteúdo
                </h2>
                <p class="text-gray-300 mb-4">
                    Adicionar, editar ou remover questões do banco de dados.
                </pos>
                <button id="admin-gerir-questoes" 
                        class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition">
                    Gerir Banco de Questões
                </button>
            </div>
            
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">
                    Gestão de Alunos
                </h2>
                <p class="text-gray-300 mb-4">
                    Ver alunos, criar acessos e gerir senhas.
                </p>
                <a href="https://console.firebase.google.com/project/meu-planner-oab/authentication/users" 
                   target="_blank" 
                   class="block w-full text-center bg-gray-600 text-white font-semibold py-2 px-4 rounded hover:bg-gray-700 transition">
                    Aceder Painel do Firebase
                </a>
            </div>
        </div>
    `;
}

// ------ (Alterado) PAINEL DO ALUNO ------
function renderStudentDashboard(userData) {
    // Classes do Tailwind para os "cards"
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    
    return `
        <h1 class="text-3xl font-bold text-white mb-6">
            Olá, <span class="text-blue-400">${userData.nome}</span>!
        </h1>

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
            <h2 class="text-2xl font-bold text-white mb-4">
                Ciclo de Estudos (Método Reverso)
            </h2>
            <p class="text-gray-300">
                (Em breve) Aqui é onde a lógica principal do seu planner será implementada.
            </p>
        </div>
    `;
}
