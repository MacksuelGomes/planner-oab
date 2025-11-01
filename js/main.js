/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO 5.2 - BANCO DE QUESTÕES V2.0)
 *
 * NOVIDADES:
 * - Adiciona os campos 'edicao' e 'tema' ao formulário de "Criar Questão".
 * - Salva estes novos campos no Firestore.
 * - Mostra os novos campos no ecrã "Listar Questões".
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db } from './auth.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- [ PARTE 2: SELETORES DO DOM ] ---
const appContent = document.getElementById('app-content');

// --- [ PARTE 3: VARIÁVEIS DE ESTADO DO QUIZ ] ---
let quizQuestoes = [];          
let quizIndexAtual = 0;         
let alternativaSelecionada = null; 
let respostaConfirmada = false;  

// --- [ PARTE 4: LISTENER DE AUTENTICAÇÃO ] ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboard(user);
    } else {
        appContent.innerHTML = '';
    }
});

// --- [ PARTE 5: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
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

// --- [ PARTE 6: GESTOR DE EVENTOS PRINCIPAL ] ---
appContent.addEventListener('click', async (e) => {
    
    // LÓGICA DE CLIQUE NA ALTERNATIVA
    const alternativaEl = e.target.closest('[data-alternativa]');
    if (alternativaEl && !respostaConfirmada) {
        alternativaSelecionada = alternativaEl.dataset.alternativa;
        document.querySelectorAll('[data-alternativa]').forEach(el => {
            el.classList.remove('bg-blue-700', 'border-blue-400');
            el.classList.add('bg-gray-700');
        });
        alternativaEl.classList.add('bg-blue-700', 'border-blue-400');
        alternativaEl.classList.remove('bg-gray-700');
        return; 
    }

    const action = e.target.dataset.action;
    if (!action) return; 

    // --- Ações de Admin ---
    if (action === 'show-create-question-form') { appContent.innerHTML = renderCreateQuestionForm(); }
    if (action === 'show-list-questions') { await renderListQuestionsUI(); }
    if (action === 'admin-voltar-painel') { loadDashboard(auth.currentUser); }
    if (action === 'delete-question') {
        const docId = e.target.dataset.id;
        await handleDeleteQuestion(docId, e.target);
    }

    // --- Ações de Aluno ---
    if (action === 'start-study-session') {
        const materia = e.target.dataset.materia;
        await handleStartStudySession(materia);
    }

    // --- Ações do Quiz ---
    if (action === 'confirmar-resposta') {
        handleConfirmarResposta();
    }
    if (action === 'proxima-questao') {
        handleProximaQuestao();
    }
    if (action === 'sair-quiz') {
        loadDashboard(auth.currentUser); 
    }
});

appContent.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    if (e.target.id === 'form-create-question') {
        await handleCreateQuestionSubmit(e.target);
    }
});


// --- [ PARTE 7: LÓGICA DE ADMIN ] ---

// ===============================================
// (ATUALIZADO) handleCreateQuestionSubmit
// ===============================================
async function handleCreateQuestionSubmit(form) {
    const statusEl = document.getElementById('form-status');
    statusEl.textContent = 'A guardar...';
    try {
        const formData = new FormData(form);
        const questaoData = {
            materia: formData.get('materia'),
            edicao: formData.get('edicao'), // <-- NOVO CAMPO
            tema: formData.get('tema'),     // <-- NOVO CAMPO
            enunciado: formData.get('enunciado'),
            alternativas: { A: formData.get('alt_a'), B: formData.get('alt_b'), C: formData.get('alt_c'), D: formData.get('alt_d') },
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

async function handleDeleteQuestion(docId, button) {
    if (!confirm('Tem a certeza que quer apagar esta questão? Esta ação não pode ser desfeita.')) { return; }
    button.textContent = 'A apagar...';
    button.disabled = true;
    try {
        await deleteDoc(doc(db, 'questoes', docId));
        const itemParaApagar = document.getElementById(`item-${docId}`);
        if (itemParaApagar) { itemParaApagar.remove(); }
    } catch (error) {
        console.error("Erro ao apagar:", error);
        button.textContent = 'Erro ao apagar';
        alert(`Erro ao apagar: ${error.message}`);
    }
}


// --- [ PARTE 8: LÓGICA DE ALUNO ] ---
async function handleStartStudySession(materia) {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("materia", "==", materia));
        const querySnapshot = await getDocs(q);
        
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push(doc.data());
        });

        if (questoesArray.length === 0) {
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão de "${materia}" encontrada.</p><button data-action="admin-voltar-painel" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar</button>`;
            return;
        }
        
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;           
        alternativaSelecionada = null;
        respostaConfirmada = false;
        
        renderQuiz(); 

    } catch (error) {
        console.error("Erro ao carregar questões do Firestore:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar questões: ${error.message}</p>`;
    }
}

function handleConfirmarResposta() {
    if (alternativaSelecionada === null) {
        alert('Por favor, selecione uma alternativa.');
        return;
    }

    respostaConfirmada = true;
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const correta = questaoAtual.correta;

    const alternativasEls = document.querySelectorAll('[data-alternativa]');
    alternativasEls.forEach(el => {
        const alt = el.dataset.alternativa;
        if (alt === correta) {
            el.classList.add('bg-green-700', 'border-green-500');
            el.classList.remove('bg-blue-700', 'bg-gray-700');
        } else if (alt === alternativaSelecionada) {
            el.classList.add('bg-red-700', 'border-red-500');
            el.classList.remove('bg-blue-700', 'bg-gray-700');
        } else {
            el.classList.add('opacity-50');
        }
    });

    const comentarioEl = document.getElementById('quiz-comentario');
    comentarioEl.innerHTML = `
        <h3 class="text-xl font-bold text-white mb-2">Gabarito & Comentário</h3>
        <p class="text-gray-300">${questaoAtual.comentario || 'Nenhum comentário disponível.'}</p>
    `;
    comentarioEl.classList.remove('hidden');

    const botaoConfirmar = document.getElementById('quiz-botao-confirmar');
    botaoConfirmar.textContent = 'Próxima Questão';
    botaoConfirmar.dataset.action = 'proxima-questao';
}

function handleProximaQuestao() {
    quizIndexAtual++; 
    
    if (quizIndexAtual >= quizQuestoes.length) {
        appContent.innerHTML = `
            <div class="text-center">
                <h1 class="text-3xl font-bold text-white mb-4">Sessão Concluída!</h1>
                <p class="text-gray-300 mb-8">Você completou ${quizQuestoes.length} questões de ${quizQuestoes[0].materia}.</p>
                <button data-action="sair-quiz" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">
                    Voltar ao Dashboard
                </button>
            </div>
        `;
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuiz();
    }
}


// --- [ PARTE 9: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---

function renderLoadingState() {
    return `<p class="text-gray-400">A carregar...</p>`;
}

// (PAINEL DE ADMIN - Sem alteração)
function renderAdminDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    return `
        <h1 class="text-3xl font-bold text-white mb-2">Painel Administrativo</h1>
        <p class="text-lg text-blue-400 mb-8">Bem-vindo, Admin ${userData.nome}!</p>
        <div class="grid md:grid-cols-2 gap-6">
            <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-4">Criar Questões</h2><p class="text-gray-300 mb-4">Adicionar questões individuais ao Firestore.</p><button data-action="show-create-question-form" class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition">Criar Nova Questão</button></div>
            <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-4">Listar / Apagar Questões</h2><p class="text-gray-300 mb-4">Ver e apagar questões existentes do Firestore.</p><button data-action="show-list-questions" class="w-full bg-yellow-600 text-white font-semibold py-2 px-4 rounded hover:bg-yellow-700 transition">Listar Questões</button></div>
            <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-4">Gestão de Alunos</h2><p class="text-gray-300 mb-4">Ver alunos, criar acessos e gerir senhas.</p><a href="https://console.firebase.google.com/project/meu-planner-oab/authentication/users" target="_blank" class="block w-full text-center bg-gray-600 text-white font-semibold py-2 px-4 rounded hover:bg-gray-700 transition">Aceder Painel do Firebase</a></div>
        </div>
    `;
}

// (PAINEL DE ALUNO - Sem alteração)
function renderStudentDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const materias = ["etica", "civil", "processo_civil", "penal", "processo_penal", "constitucional", "administrativo", "tributario", "empresarial", "trabalho", "processo_trabalho"];
    return `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3><p class="text-3xl font-bold text-white mt-2">0%</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Dias de Estudo</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
        </div>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Ciclo de Estudos (Método Reverso)</h2>
            <p class="text-gray-300 mb-6">Selecione uma matéria para iniciar:</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${materias.map(materia => `
                    <button data-action="start-study-session" data-materia="${materia}" class="p-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 capitalize">
                        ${materia.replace('_', ' ')}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

// ===============================================
// (ATUALIZADO) renderCreateQuestionForm
// ===============================================
function renderCreateQuestionForm() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";
    return `
        <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
        <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-6">Criar Nova Questão</h2>
            <form id="form-create-question" class="space-y-4">
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="materia" class="${labelStyle}">Matéria (ex: etica, civil)</label>
                        <input type="text" id="materia" name="materia" required class="${inputStyle}">
                    </div>
                    <div>
                        <label for="edicao" class="${labelStyle}">Edição (ex: OAB-38, OAB-37)</label>
                        <input type="text" id="edicao" name="edicao" required class="${inputStyle}">
                    </div>
                </div>
                <div>
                    <label for="tema" class="${labelStyle}">Tema (ex: Honorários, Recursos)</label>
                    <input type="text" id="tema" name="tema" class="${inputStyle}">
                </div>
                <div><label for="enunciado" class="${labelStyle}">Enunciado da Questão</label><textarea id="enunciado" name="enunciado" rows="3" required class="${inputStyle}"></textarea></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label for="alt_a" class="${labelStyle}">Alternativa A</label><input type="text" id="alt_a" name="alt_a" required class="${inputStyle}"></div>
                    <div><label for="alt_b" class="${labelStyle}">Alternativa B</label><input type="text" id="alt_b" name="alt_b" required class="${inputStyle}"></div>
                    <div><label for="alt_c" class="${labelStyle}">Alternativa C</label><input type="text" id="alt_c" name="alt_c" required class="${inputStyle}"></div>
                    <div><label for="alt_d" class="${labelStyle}">Alternativa D</label><input type="text" id="alt_d" name="alt_d" required class="${inputStyle}"></div>
                </div>
                <div><label for="correta" class="${labelStyle}">Alternativa Correta</label><select id="correta" name="correta" required class="${inputStyle}"><option value="">Selecione...</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
                <div><label for="comentario" class="${labelStyle}">Comentário (Fundamentação)</label><textarea id="comentario" name="comentario" rows="3" class="${inputStyle}"></textarea></div>
                <div><button type="submit" class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">Guardar Questão</button></div>
                <div id="form-status" class="text-sm text-center mt-4"></div>
            </form>
        </div>
    `;
}

// ===============================================
// (ATUALIZADO) renderListQuestionsUI
// ===============================================
async function renderListQuestionsUI() { 
    appContent.innerHTML = renderLoadingState(); 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    let listHtml = "";
    try {
        const questoesRef = collection(db, 'questoes');
        const querySnapshot = await getDocs(questoesRef);
        if (querySnapshot.empty) {
            listHtml = "<p class='text-gray-400'>Nenhuma questão encontrada no Firestore.</p>";
        } else {
            querySnapshot.forEach((doc) => {
                const questao = doc.data();
                const docId = doc.id;
                // (ATUALIZADO PARA MOSTRAR MAIS DADOS)
                listHtml += `
                    <div id="item-${docId}" class="p-4 bg-gray-900 rounded-lg flex items-center justify-between">
                        <div>
                            <span class="text-sm font-bold uppercase text-blue-400">${questao.materia} | ${questao.edicao || 'N/A'}</span>
                            <p class="text-white">${questao.enunciado.substring(0, 80)}...</p>
                            <p class="text-xs text-gray-400 mt-1">Tema: ${questao.tema || 'Não definido'}</p>
                        </div>
                        <button data-action="delete-question" data-id="${docId}" class="bg-red-600 text-white font-semibold py-1 px-3 rounded hover:bg-red-700 transition text-sm">Apagar</button>
                    </div>
                `;
            });
        }
        appContent.innerHTML = `
            <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
            <div class="${cardStyle}">
                <h2 class="text-2xl font-bold text-white mb-6">Listar / Apagar Questões</h2>
                <div class="space-y-4">${listHtml}</div>
            </div>
        `;
    } catch (error) {
        console.error("Erro ao listar questões:", error);
        appContent.innerHTML = `<p>Erro ao listar: ${error.message}</p>`;
    }
}

// (HTML DO QUIZ - Sem alteração)
function renderQuiz() {
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const materia = questaoAtual.materia;
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const alternativaStyle = "p-4 bg-gray-700 rounded-lg text-white hover:bg-gray-600 cursor-pointer transition border border-transparent";
    appContent.innerHTML = `
        <h2 class="text-2xl font-bold text-white mb-2 capitalize">Matéria: ${materia.replace('_', ' ')}</h2>
        <p class="text-gray-400 mb-6">Questão ${quizIndexAtual + 1} de ${quizQuestoes.length}</p>
        <div class="${cardStyle}">
            <div class="mb-6"><p class="text-gray-400 text-sm mb-2">Enunciado da Questão</p><p class="text-white text-lg">${questaoAtual.enunciado}</p></div>
            <div class="space-y-4">
                <div class="${alternativaStyle}" data-alternativa="A"><span class="font-bold mr-2">A)</span> ${questaoAtual.alternativas.A}</div>
                <div class="${alternativaStyle}" data-alternativa="B"><span class="font-bold mr-2">B)</span> ${questaoAtual.alternativas.B}</div>
                <div class="${alternativaStyle}" data-alternativa="C"><span class="font-bold mr-2">C)</span> ${questaoAtual.alternativas.C}</div>
                <div class="${alternativaStyle}" data-alternativa="D"><span class="font-bold mr-2">D)</span> ${questaoAtual.alternativas.D}</div>
            </div>
        </div>
        <div id="quiz-comentario" class="${cardStyle} mt-6 hidden"></div>
        <div class="mt-6 flex justify-between">
            <button data-action="sair-quiz" class="bg-gray-600 text-white font-semibold py-2 px-6 rounded hover:bg-gray-700 transition">Sair</button>
            <button id="quiz-botao-confirmar" data-action="confirmar-resposta" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">Confirmar Resposta</button>
        </div>
    `;
}
