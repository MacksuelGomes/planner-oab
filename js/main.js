/*
 * ========================================================
 * ARQUIVO: js/main.js
 * O CÉREBRO DO APLICATIVO (DASHBOARD E LÓGICA)
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

        // 2. Busca os dados do perfil (ex: nome) no Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // 3. Desenha o dashboard com os dados do utilizador
            appContent.innerHTML = renderDashboard(userData);

            // 4. (Futuro) Adiciona os event listeners do dashboard
            // ex: addDashboardListeners();
            
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
    return `<p class="text-gray-400">A carregar o seu progresso...</p>`;
}

// Desenha o Dashboard principal
// (POR AGORA, é um placeholder. Aqui é onde o seu Ciclo de Estudos vai viver)
function renderDashboard(userData) {
    
    // Classes do Tailwind para os "cards" do dashboard
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
                Aqui é onde a lógica principal do seu planner será implementada. 
                Iremos mostrar as matérias do dia, permitir registar questões 
                e atualizar o ciclo.
            </p>
            </div>
    `;
}