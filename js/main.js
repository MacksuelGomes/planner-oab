/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO 3.1)
 * O CÉREBRO DO APLICATIVO (DASHBOARD E LÓGICA)
 *
 * NOVIDADES:
 * - CORRIGE o bug 'storage/invalid-format' ao publicar.
 * (Troca 'data_url' por 'raw' no uploadString)
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db, storage } from './auth.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    ref, uploadString 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// --- [ PARTE 2: SELETORES DO DOM ] ---
const appContent = document.getElementById('app-content');

// --- [ PARTE 3: LISTENER DE AUTENTICAÇÃO ] ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboard(user);
    } else {
        appContent.innerHTML = '';
    }
});

// --- [ PARTE 4: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
async function loadDashboard(user) {
    try {
        appContent.innerHTML = renderLoadingState();
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                appContent.innerHTML = renderStudentDashboard(userData);
            }
        } else {
            appContent.innerHTML = `<p>Erro: Perfil não encontrado.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        appContent.innerHTML = `<p>Ocorreu um erro ao carregar seus dados.</p>`;
    }
}

// --- [ PARTE 5: GESTOR DE EVENTOS PRINCIPAL ] ---
appContent.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    
    if (action === 'show-create-question-form') {
        appContent.innerHTML = renderCreateQuestionForm();
    }
    
    if (action === 'show-publish-ui') {
        appContent.innerHTML = renderPublishUI();
    }
    
    if (action === 'admin-voltar-painel') {
        loadDashboard(auth.currentUser); // Recarrega o dashboard
    }
    
    if (action === 'publish-materia') {
        const materia = e.target.dataset.materia;
        await handlePublishMateria(materia, e.target);
    }
});

appContent.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    if (e.target.id === 'form-create-question') {
        await handleCreateQuestionSubmit(e.target);
    }
});


// --- [ PARTE 6: LÓGICA DE ADMIN - CRIAR QUESTÃO ] ---
async function handleCreateQuestionSubmit(form) {
    const statusEl = document.getElementById('form-status');
    statusEl.textContent = 'A guardar...';
    
    try {
        const formData = new FormData(form);
        const questaoData = {
            materia: formData.get('materia'),
            enunciado: formData.get('enunciado'),
            alternativas: {
                A: formData.get('alt_a'),
                B: formData.get('alt_b'),
                C: formData.get('alt_c'),
                D: formData.get('alt_d'),
            },
            correta: formData.get('correta'),
            comentario: formData.get('comentario'),
            id: `${formData.get('materia').toUpperCase()}-${Date.now().toString().slice(-5)}`
        };

        const questoesRef = collection(db, 'questoes');
        await addDoc(questoesRef, questaoData);

        statusEl.textContent = 'Questão guardada com sucesso!';
        statusEl.className = 'text-green-400 text-sm mt-4';
        form.reset();
        
    } catch (error) {
        console.error("Erro ao guardar questão:", error);
        statusEl.textContent = `Erro ao guardar: ${error.message}`;
        statusEl.className = 'text-red-400 text-sm mt-4';
    }
}

// --- [ PARTE 7: LÓGICA DE ADMIN - PUBLICAR QUESTÕES ] ---
async function handlePublishMateria(materia, button) {
    button.textContent = 'A publicar...';
    button.disabled = true;
    
    const statusEl = document.getElementById(`status-${materia}`);
    statusEl.textContent = 'A procurar questões no Firestore...';

    try {
        // 1. Buscar todas as questões daquela matéria no Firestore
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("materia", "==", materia));
        
        const querySnapshot = await getDocs(q);
        
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push(doc.data());
        });

        if (questoesArray.length === 0) {
            statusEl.textContent = 'Nenhuma questão encontrada para esta matéria.';
            button.textContent = `Publicar ${materia}`;
            button.disabled = false;
            return;
        }

        // 2. Compilar o ficheiro JSON
        statusEl.textContent = `A compilar ${questoesArray.length} questões...`;
        const jsonData = {
            materia: materia,
            total_questoes: questoesArray.length,
            questoes: questoesArray
        };
        const jsonString = JSON.stringify(jsonData);

        // 3. Definir o caminho no Storage (ex: banco-questoes/etica.json)
        const storageRef = ref(storage, `banco-questoes/${materia.toLowerCase()}.json`);

        // 4. Fazer o upload do ficheiro JSON
        statusEl.textContent = 'A fazer upload para o Storage...';
        
        // ===============================================
        // AQUI ESTÁ A CORREÇÃO (linha 160 aprox.)
        // Trocámos 'data_url' por 'raw'
        // ===============================================
        await uploadString(storageRef, jsonString, 'raw');
        
        statusEl.textContent = `Sucesso! "${materia}.json" publicado com ${questoesArray.length} questões.`;
        statusEl.className = 'text-green-400 text-sm';
        button.textContent = `Publicar ${materia}`;
        button.disabled = false;

    } catch (error) {
        console.error("Erro ao publicar:", error);
        statusEl.textContent = `Erro: ${error.message}`;
        statusEl.className = 'text-red-400 text-sm';
        button.textContent = `Publicar ${materia}`;
        button.disabled = false;
    }
}


// --- [ PARTE 8: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---

function renderLoadingState() {
    return `<p class="text-gray-400">A carregar os seus dados...</p>`;
}

// (PAINEL DE ADMIN ATUALIZADO)
function renderAdminDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    
    return `
        <h1 class="text-3xl font-bold text-white mb-2">Painel Administrativo</h1>
        <p class="text-lg text-blue-400 mb-8">Bem-vindo, Admin ${userData.nome}!</p>

        <div class="grid md:grid-cols-2 gap-6">
            
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">Gestão de Questões</h2>
                <p class="text-gray-300 mb-4">Adicionar ou editar questões individuais no Firestore.</p>
                <button data-action="show-create-question-form" 
                        class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition">
                    Criar Nova Questão
                </button>
            </div>
            
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-4">Publicar Alterações</h2>
                <p class="text-gray-300 mb-4">Enviar as questões do Firestore para o Storage (para os alunos).</p>
                <button data-action="show-publish-ui" 
                        class="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded hover:bg-green-700 transition">
                    Publicar Banco de Questões
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

// (PAINEL DE ALUNO - Sem alteração)
function renderStudentDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    
    return `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3><p class="text-3xl font-bold text-white mt-2">0%</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Dias de Estudo</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
        </div>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-4">Ciclo de Estudos (Método Reverso)</h2>
            <p class="text-gray-300">(Em breve) Aqui é onde a lógica principal do seu planner será implementada.</p>
        </div>
    `;
}

// (HTML DO FORMULÁRIO DE QUESTÃO)
function renderCreateQuestionForm() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";

    return `
        <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Criar Nova Questão</h2>
            
            <form id="form-create-question" class="space-y-4">
                
                <div>
                    <label for="materia" class="${labelStyle}">Matéria (ex: etica, civil, penal)</label>
                    <input type="text" id="materia" name="materia" required class="${inputStyle}">
                </div>
                
                <div>
                    <label for="enunciado" class="${labelStyle}">Enunciado da Questão</label>
                    <textarea id="enunciado" name="enunciado" rows="3" required class="${inputStyle}"></textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="alt_a" class="${labelStyle}">Alternativa A</label>
                        <input type="text" id="alt_a" name="alt_a" required class="${inputStyle}">
                    </div>
                    <div>
                        <label for="alt_b" class="${labelStyle}">Alternativa B</label>
                        <input type="text" id="alt_b" name="alt_b" required class="${inputStyle}">
                    </div>
                    <div>
                        <label for="alt_c" class="${labelStyle}">Alternativa C</label>
                        <input type="text" id="alt_c" name="alt_c" required class="${inputStyle}">
                    </div>
                    <div>
                        <label for="alt_d" class="${labelStyle}">Alternativa D</label>
                        <input type="text" id="alt_d" name="alt_d" required class="${inputStyle}">
                    </div>
                </div>

                <div>
                    <label for="correta" class="${labelStyle}">Alternativa Correta</label>
                    <select id="correta" name="correta" required class="${inputStyle}">
                        <option value="">Selecione...</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                    </select>
                </div>
                
                <div>
                    <label for="comentario" class="${labelStyle}">Comentário (Fundamentação)</label>
                    <textarea id="comentario" name="comentario" rows="3" class="${inputStyle}"></textarea>
                </div>
                
                <div>
                    <button type="submit" 
                            class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Guardar Questão
                    </button>
                </div>
                
                <div id="form-status" class="text-sm text-center mt-4"></div>
            
            </form>
        </div>
    `;
}

// (HTML DA UI DE PUBLICAÇÃO)
function renderPublishUI() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    
    // Lista de matérias. Adicione/remova conforme necessário.
    const materias = ["etica", "civil", "processo_civil", "penal", "processo_penal", "constitucional", "administrativo", "tributario", "empresarial", "trabalho", "processo_trabalho"];

    return `
        <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Publicar Banco de Questões</h2>
            <p class="text-gray-300 mb-6">
                Isto irá ler todas as questões do Firestore e compilar os ficheiros JSON
                para os alunos no Storage.
            </p>
            
            <div class="space-y-4">
                ${materias.map(materia => `
                    <div class="p-4 bg-gray-900 rounded-lg flex items-center justify-between">
                        <span class="text-lg text-white font-medium">${materia}.json</span>
                        <button data-action="publish-materia" data-materia="${materia}"
                                class="bg-green-600 text-white font-semibold py-1 px-3 rounded hover:bg-green-700 transition text-sm">
                            Publicar ${materia}
                        </button>
                    </div>
                    <div id="status-${materia}" class="text-sm text-gray-400 ml-1"></div>
                `).join('')}
            </div>
        </div>
    `;
}
