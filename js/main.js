/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO 5.9 - CORREÇÃO NAVEGAÇÃO "SAIR")
 *
 * NOVIDADES:
 * - Remove a variável global 'quizReturnPath'.
 * - Passa o caminho de retorno (returnPath) via 'data-return-path'
 * no botão 'Sair'.
 * - Corrige o bug do botão "Sair" do Estudo Livre.
 * - Corrige o bug do botão "Sair" do Simulado.
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db } from './auth.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- [ PARTE 2: SELETORES DO DOM ] ---
const appContent = document.getElementById('app-content');

// --- [ PARTE 3: DEFINIÇÃO DO CICLO DE ESTUDOS ] ---
const CICLO_DE_ESTUDOS = [
    "etica", "constitucional", "civil", "processo_civil", "penal", 
    "processo_penal", "administrativo", "tributario", "trabalho", 
    "processo_trabalho", "empresarial", 
    "etica", "constitucional", "civil", "processo_civil", "penal"
];

// --- [ PARTE 4: VARIÁVEIS DE ESTADO DO QUIZ ] ---
let quizQuestoes = [];          
let quizIndexAtual = 0;         
let alternativaSelecionada = null; 
let respostaConfirmada = false;  
let metaQuestoesDoDia = 0; 
let cronometroInterval = null; 
// let quizReturnPath = 'menu'; // <-- REMOVIDO!

// --- [ PARTE 5: LISTENER DE AUTENTICAÇÃO ] ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboard(user);
    } else {
        appContent.innerHTML = '';
        if (cronometroInterval) clearInterval(cronometroInterval); 
    }
});

// --- [ PARTE 6: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
async function loadDashboard(user) {
    if (cronometroInterval) clearInterval(cronometroInterval); 
    try {
        appContent.innerHTML = renderLoadingState();
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                appContent.innerHTML = renderStudentDashboard_Menu(userData);
            }
        } else {
            appContent.innerHTML = `<p>Erro: Perfil não encontrado.</p>`;
        }
    } catch (error) { 
        console.error("Erro ao carregar dashboard:", error);
        appContent.innerHTML = `<p>Ocorreu um erro ao carregar seus dados.</p>`;
    }
}

// --- [ PARTE 7: GESTOR DE EVENTOS PRINCIPAL ] ---
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

    const actionButton = e.target.closest('[data-action]');
    if (!actionButton) return; 

    const action = actionButton.dataset.action; 
    
    // --- Ações de Admin ---
    if (action === 'show-create-question-form') { appContent.innerHTML = renderCreateQuestionForm(); }
    if (action === 'show-list-questions') { await renderListQuestionsUI(); }
    if (action === 'admin-voltar-painel') { loadDashboard(auth.currentUser); }
    if (action === 'delete-question') {
        const docId = actionButton.dataset.id;
        await handleDeleteQuestion(docId, actionButton);
    }

    // --- Ações de Aluno ---
    if (action === 'show-guided-planner') {
        const user = auth.currentUser;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData.metaDiaria) {
            appContent.innerHTML = renderPlanner_TarefaDoDia(userData);
        } else {
            appContent.innerHTML = renderPlannerSetupForm();
        }
    }
    if (action === 'show-free-study') {
        appContent.innerHTML = renderFreeStudyDashboard(auth.currentUser.uid);
    }
    if (action === 'show-simulados-menu') {
        appContent.innerHTML = renderSimuladosMenu();
    }
    if (action === 'student-voltar-menu') {
        loadDashboard(auth.currentUser); 
    }
    if (action === 'start-study-session') {
        const materia = actionButton.dataset.materia;
        // (ATUALIZADO) Passa o caminho de retorno para a função de início
        const returnPath = actionButton.closest('[data-return-context]')?.dataset.returnContext || 'menu';
        await handleStartStudySession(materia, returnPath);
    }
    if (action === 'start-simulado-edicao') {
        const edicao = actionButton.dataset.edicao;
        await handleStartSimulado(edicao);
    }


    // --- Ações do Quiz ---
    if (action === 'confirmar-resposta') { handleConfirmarResposta(); }
    if (action === 'proxima-questao') { 
        // (ATUALIZADO) Passa o caminho de retorno
        const returnPath = actionButton.dataset.returnPath;
        await handleProximaQuestao(returnPath); 
    }
    if (action === 'sair-quiz') {
        // (ATUALIZADO) Lê o caminho de retorno do próprio botão
        const returnPath = actionButton.dataset.returnPath;
        if (returnPath === 'free-study') {
            appContent.innerHTML = renderFreeStudyDashboard(auth.currentUser.uid);
        } else if (returnPath === 'simulados') {
            appContent.innerHTML = renderSimuladosMenu();
        } else {
            loadDashboard(auth.currentUser); 
        }
    }
});

appContent.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    if (e.target.id === 'form-create-question') {
        await handleCreateQuestionSubmit(e.target);
    }
    if (e.target.id === 'form-planner-setup') {
        await handleSavePlannerSetup(e.target);
    }
});


// --- [ PARTE 8: LÓGICA DE ADMIN ] ---
// (Sem alteração)
async function handleCreateQuestionSubmit(form) { /* ...código omitido... */ 
    const statusEl = document.getElementById('form-status');
    statusEl.textContent = 'A guardar...';
    try {
        const formData = new FormData(form);
        const questaoData = {
            materia: formData.get('materia'),
            edicao: formData.get('edicao'),
            tema: formData.get('tema'),
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
async function handleDeleteQuestion(docId, button) { /* ...código omitido... */ 
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


// --- [ PARTE 9: LÓGICA DE ALUNO ] ---
// (Sem alteração)
async function handleSavePlannerSetup(form) { /* ...código omitido... */ 
    const meta = form.metaDiaria.value;
    const botao = form.querySelector('button');
    botao.textContent = 'A guardar...';
    botao.disabled = true;
    try {
        const user = auth.currentUser;
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
            metaDiaria: parseInt(meta, 10), 
            cicloIndex: 0 
        });
        const userDoc = await getDoc(userDocRef);
        appContent.innerHTML = renderPlanner_TarefaDoDia(userDoc.data());
    } catch (error) {
        console.error("Erro ao salvar configuração:", error);
        botao.textContent = 'Erro ao salvar!';
    }
}

// (ATUALIZADO) Agora aceita o 'returnPath'
async function handleStartStudySession(materia, returnPath) {
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
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão de "${materia}" encontrada.</p><button data-action="student-voltar-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>`;
            return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data();
        
        if (returnPath === 'menu') { // Veio do 'guided'
            metaQuestoesDoDia = userData?.metaDiaria || 20;
        } else { // Veio do 'free-study'
            metaQuestoesDoDia = questoesArray.length;
        }

        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;           
        alternativaSelecionada = null;
        respostaConfirmada = false;
        
        renderQuiz("Estudo de Matéria", null, returnPath); // Passa o caminho de retorno

    } catch (error) {
        console.error("Erro ao carregar questões do Firestore:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar questões: ${error.message}</p>`;
    }
}

// (ATUALIZADO) Agora aceita o 'returnPath'
async function handleProximaQuestao(returnPath) {
    quizIndexAtual++; 
    
    if (quizIndexAtual >= quizQuestoes.length || (returnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia) ) {
        
        let textoFinal = `Você completou ${quizIndexAtual} questões de ${quizQuestoes[0].materia}.`;
        let textoBotao = "Voltar ao Estudo Livre"; 
        let returnAction = 'free-study'; // Onde o botão 'Sair' vai levar

        if (returnPath === 'menu') { 
            textoFinal = `Você completou sua meta de ${metaQuestoesDoDia} questões de ${quizQuestoes[0].materia}!`;
            textoBotao = "Voltar ao Menu Principal";
            returnAction = 'menu';
        }
        
        if (returnPath === 'simulado') {
            textoFinal = `Você completou o simulado de ${quizQuestoes.length} questões.`;
            textoBotao = "Voltar ao Menu de Simulados";
            returnAction = 'simulados';
        }

        if (cronometroInterval) clearInterval(cronometroInterval); 

        appContent.innerHTML = `
            <div class="text-center">
                <h1 class="text-3xl font-bold text-white mb-4">Sessão Concluída!</h1>
                <p class="text-gray-300 mb-8">${textoFinal}</p>
                <button data-action="sair-quiz" data-return-path="${returnAction}" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">
                    ${textoBotao}
                </button>
            </div>
        `;
        
        if (returnPath === 'menu') {
            try {
                // ... (lógica de atualizar ciclo, sem alteração)
                const user = auth.currentUser;
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                const dadosAtuais = userDoc.data();
                let novoIndex = (dadosAtuais.cicloIndex || 0) + 1;
                if (novoIndex >= CICLO_DE_ESTUDOS.length) {
                    novoIndex = 0;
                }
                await updateDoc(userDocRef, { cicloIndex: novoIndex });
            } catch (error) {
                console.error("Erro ao atualizar o ciclo:", error);
            }
        }
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuiz(
            returnPath === 'simulado' ? `Simulado ${quizQuestoes[0].edicao}` : 'Estudo de Matéria',
            null,
            returnPath
        );
    }
}
// (Sem alteração)
function handleConfirmarResposta() { /* ...código omitido... */ 
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
    // (ATUALIZADO) Passa o caminho de retorno para o botão "Próxima Questão"
    botaoConfirmar.dataset.returnPath = document.getElementById('quiz-botao-sair').dataset.returnPath;
}

// (ATUALIZADO)
async function handleStartSimulado(edicao) {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("edicao", "==", edicao));
        const querySnapshot = await getDocs(q);
        const questoesArray = [];
        querySnapshot.forEach((doc) => { questoesArray.push(doc.data()); });

        if (questoesArray.length === 0) {
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão da "${edicao}" encontrada.</p><button data-action="show-simulados-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar</button>`;
            return;
        }
        
        metaQuestoesDoDia = questoesArray.length; 
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;           
        alternativaSelecionada = null;
        respostaConfirmada = false;
        
        // (ATUALIZADO) Passa o caminho de retorno
        renderQuiz(`Simulado ${edicao}`, 5 * 60 * 60, 'simulado'); 

    } catch (error) {
        console.error("Erro ao carregar simulado:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar simulado: ${error.message}</p>`;
    }
}

// (Sem alteração)
function startCronometro(duracaoSegundos) { /* ...código omitido... */ 
    if (cronometroInterval) clearInterval(cronometroInterval); 

    const cronometroEl = document.getElementById('quiz-cronometro');
    if (!cronometroEl) return;

    let tempoRestante = duracaoSegundos;

    cronometroInterval = setInterval(() => {
        const horas = Math.floor(tempoRestante / 3600);
        const minutos = Math.floor((tempoRestante % 3600) / 60);
        const segundos = tempoRestante % 60;

        cronometroEl.textContent = 
            `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

        if (--tempoRestante < 0) {
            clearInterval(cronometroInterval);
            cronometroEl.textContent = "Tempo Esgotado!";
        }
    }, 1000);
}


// --- [ PARTE 10: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---

// (Sem alteração)
function renderLoadingState() { /* ...código omitido... */ 
    return `<p class="text-gray-400">A carregar...</p>`;
}
// (Sem alteração)
function renderAdminDashboard(userData) { /* ...código omitido... */ 
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
// (Sem alteração)
function renderStudentDashboard_Menu(userData) { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const cardHover = "hover:bg-gray-700 hover:border-blue-400 transition duration-300 cursor-pointer";
    return `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3><p class="text-3xl font-bold text-white mt-2">0%</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Dias de Estudo</h3><p class="text-3xl font-bold text-white mt-2">0</p></div>
        </div>
        <h2 class="text-2xl font-bold text-white mb-6">Escolha seu modo de estudo:</h2>
        <div class="grid md:grid-cols-3 gap-6">
            <div data-action="show-guided-planner" class="${cardStyle} ${cardHover}">
                <h3 class="text-2xl font-bold text-blue-400 mb-3">Planner Guiado</h3>
                <p class="text-gray-300">Siga um ciclo de estudos automático com metas diárias.</p>
            </div>
            <div data-action="show-free-study" class="${cardStyle} ${cardHover}">
                <h3 class="text-2xl font-bold text-blue-400 mb-3">Estudo Livre</h3>
                <p class="text-gray-300">Escolha qualquer matéria, a qualquer momento, sem metas.</p>
            </div>
            <div data-action="show-simulados-menu" class="${cardStyle} ${cardHover}">
                <h3 class="text-2xl font-bold text-blue-400 mb-3">Simulados</h3>
                <p class="text-gray-300">Faça provas completas por edição ou por temas.</p>
            </div>
        </div>
    `;
}
// (Sem alteração)
function renderPlanner_TarefaDoDia(userData) { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const cicloIndex = userData.cicloIndex || 0;
    const materiaDoDia = CICLO_DE_ESTUDOS[cicloIndex];
    const metaDoDia = userData.metaDiaria;
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle} border-l-4 border-blue-400">
            <h2 class="text-2xl font-bold text-white mb-4">Sua Tarefa de Hoje</h2>
            <p class="text-gray-300 mb-6 text-lg">
                Hoje é dia de <strong class="text-blue-300 capitalize">${materiaDoDia.replace('_', ' ')}</strong>.
                Sua meta é resolver ${metaDoDia} questões.
            </p>
            <button data-action="start-study-session" data-materia="${materiaDoDia}"
                    class="w-full md:w-auto p-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition duration-300"
                    data-return-context="menu"> Iniciar ${metaDoDia} Questões de ${materiaDoDia.replace('_', ' ')}
            </button>
        </div>
    `;
}
// (ATUALIZADO)
function renderFreeStudyDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const materias = ["etica", "civil", "processo_civil", "penal", "processo_penal", "constitucional", "administrativo", "tributario", "empresarial", "trabalho", "processo_trabalho"];
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}" data-return-context="free-study"> 
            <h2 class="text-2xl font-bold text-white mb-6">Estudo Livre</h2>
            <p class="text-gray-300 mb-6">Selecione uma matéria para iniciar (sem meta de questões):</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${materias.map(materia => `
                    <button data-action="start-study-session" data-materia="${materia}"
                            class="p-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 capitalize">
                        ${materia.replace('_', ' ')}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}
// (Sem alteração)
function renderPlannerSetupForm() { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle} max-w-lg mx-auto">
            <h2 class="text-2xl font-bold text-white mb-4">Vamos configurar sua meta</h2>
            <p class="text-gray-300 mb-6">Quantas questões você se compromete a resolver por dia de estudo?</p>
            <form id="form-planner-setup" class="space-y-4">
                <div>
                    <label for="metaDiaria" class="${labelStyle}">Meta de Questões Diárias (ex: 20, 30)</label>
                    <input type="number" id="metaDiaria" name="metaDiaria" min="1" value="20" required class="${inputStyle}">
                </div>
                <div>
                    <button type="submit" class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition duration-300">
                        Salvar e Iniciar Planner
                    </button>
                </div>
            </form>
        </div>
    `;
}
// (Sem alteração)
function renderCreateQuestionForm() { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";
    return `
        <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
        <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-6">Criar Nova Questão</h2>
            <form id="form-create-question" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label for="materia" class="${labelStyle}">Matéria (ex: etica, civil)</label><input type="text" id="materia" name="materia" required class="${inputStyle}"></div>
                    <div><label for="edicao" class="${labelStyle}">Edição (ex: OAB-38, OAB-37)</label><input type="text" id="edicao" name="edicao" required class="${inputStyle}"></div>
                </div>
                <div><label for="tema" class="${labelStyle}">Tema (ex: Honorários, Recursos)</label><input type="text" id="tema" name="tema" class="${inputStyle}"></div>
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
// (Sem alteração)
async function renderListQuestionsUI() { /* ...código omitido... */ 
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
// (Sem alteração)
function renderSimuladosMenu() { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const cardHover = "hover:bg-gray-700 hover:border-blue-400 transition duration-300 cursor-pointer";
    const edicoes = ["OAB-38", "OAB-37", "OAB-36", "OAB-35"];
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Simulados</h2>
            <p class="text-gray-300 mb-6">Escolha um tipo de simulado para iniciar:</p>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="${cardStyle}">
                    <h3 class="text-xl font-bold text-blue-400 mb-4">Por Edição Anterior</h3>
                    <div class="grid grid-cols-2 gap-3">
                        ${edicoes.map(ed => `
                            <button data-action="start-simulado-edicao" data-edicao="${ed}"
                                    class="p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                                ${ed}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div data-action="start-simulado-acertivo" class="${cardStyle} ${cardHover} opacity-50 cursor-not-allowed">
                    <h3 class="text-xl font-bold text-blue-400 mb-4">Simulado Acertivo (Em Breve)</h3>
                    <p class="text-gray-400">Um simulado de 80 questões focado apenas nos temas mais cobrados.</p>
                </div>
            </div>
        </div>
    `;
}

// ===============================================
// (ATUALIZADO) renderQuiz - agora com o 'data-return-path'
// ===============================================
function renderQuiz(titulo, duracaoSegundos = null, returnPath = 'menu') {
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const materia = questaoAtual.materia;
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const alternativaStyle = "p-4 bg-gray-700 rounded-lg text-white hover:bg-gray-600 cursor-pointer transition border border-transparent";
    const metaDoQuiz = (returnPath === 'menu') ? metaQuestoesDoDia : quizQuestoes.length;

    let cronometroHtml = '';
    if (duracaoSegundos) {
        cronometroHtml = `
            <div class="fixed top-20 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-blue-500">
                <span class="text-2xl font-mono" id="quiz-cronometro">05:00:00</span>
            </div>
        `;
    }

    appContent.innerHTML = `
        ${cronometroHtml}
        <h2 class="text-2xl font-bold text-white mb-2 capitalize">${titulo}</h2>
        <p class="text-gray-400 mb-6">Questão ${quizIndexAtual + 1} de ${Math.min(quizQuestoes.length, metaDoQuiz)}</p>
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
            <button id="quiz-botao-sair" data-action="sair-quiz" data-return-path="${returnPath}" class="bg-gray-600 text-white font-semibold py-2 px-6 rounded hover:bg-gray-700 transition">Sair</button>
            
            <button id="quiz-botao-confirmar" data-action="confirmar-resposta" data-return-path="${returnPath}" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">Confirmar Resposta</button>
        </div>
    `;

    if (duracaoSegundos) {
        startCronometro(duracaoSegundos);
    }
}
