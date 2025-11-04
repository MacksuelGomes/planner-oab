/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO 5.19 - Caderno de Erros)
 *
 * NOVIDADES:
 * - Adiciona o card "Caderno de Erros" ao painel.
 * - Na 'handleConfirmarResposta', questões erradas agora
 * são salvas na subcoleção 'questoes_erradas' do usuário.
 * - Nova função 'handleStartCadernoErros' para iniciar
 * um quiz apenas com as questões erradas.
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db } from './auth.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc,
    setDoc, increment 
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
let quizReturnPath = 'menu'; 
let quizTitle = 'Estudo'; 

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
            let userData = userDoc.data();
            
            // --- (LÓGICA DE SEQUÊNCIA) ---
            const hojeStr = getFormattedDate(new Date());
            const ultimoLoginData = userData.ultimoLogin ? userData.ultimoLogin.toDate() : null;
            const ultimoLoginStr = ultimoLoginData ? getFormattedDate(ultimoLoginData) : null;

            if (ultimoLoginStr !== hojeStr) {
                // É o primeiro login do dia, vamos atualizar as stats
                const ontem = new Date();
                ontem.setDate(ontem.getDate() - 1);
                const ontemStr = getFormattedDate(ontem);

                const totalDiasEstudo = (userData.totalDiasEstudo || 0) + 1;
                let sequenciaDias = 1; // Default
                
                if (ultimoLoginStr === ontemStr) {
                    // O último login foi ontem, continua a sequência
                    sequenciaDias = (userData.sequenciaDias || 0) + 1;
                }
                
                // Atualiza o documento no Firestore
                const novosDados = {
                    totalDiasEstudo: totalDiasEstudo,
                    sequenciaDias: sequenciaDias,
                    ultimoLogin: new Date()
                };
                await updateDoc(userDocRef, novosDados);

                // Atualiza o objeto 'userData' local para renderizar com os dados novos
                userData = { ...userData, ...novosDados };
            }
            // --- (FIM DA LÓGICA DE SEQUÊNCIA) ---

            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                appContent.innerHTML = await renderStudentDashboard_Menu(userData);
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
        quizReturnPath = 'menu'; 
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
        quizReturnPath = 'free-study'; 
        appContent.innerHTML = renderFreeStudyDashboard(auth.currentUser.uid);
    }
    if (action === 'show-simulados-menu') {
        quizReturnPath = 'simulados'; 
        appContent.innerHTML = renderSimuladosMenu();
    }
    // (NOVO) Ação do Caderno de Erros
    if (action === 'show-caderno-erros') {
        quizReturnPath = 'erros'; // Define um novo caminho de retorno
        await handleStartCadernoErros();
    }
    if (action === 'student-voltar-menu') {
        loadDashboard(auth.currentUser); 
    }
    if (action === 'start-study-session') {
        const materia = actionButton.dataset.materia;
        await handleStartStudySession(materia);
    }
    if (action === 'start-simulado-edicao') {
        const edicao = actionButton.dataset.edicao;
        await handleStartSimulado(edicao);
    }
    if (action === 'start-simulado-acertivo') {
        await handleStartSimuladoAcertivo();
    }
    if (action === 'resetar-desempenho') {
        await handleResetarDesempenho();
    }

    // --- Ações do Quiz ---
    if (action === 'confirmar-resposta') { await handleConfirmarResposta(); }
    if (action === 'proxima-questao') { await handleProximaQuestao(); }
    if (action === 'sair-quiz') {
        if (quizReturnPath === 'free-study') {
            appContent.innerHTML = renderFreeStudyDashboard(auth.currentUser.uid);
        } else if (quizReturnPath === 'simulados') {
            appContent.innerHTML = renderSimuladosMenu();
        } else if (quizReturnPath === 'erros') { // (NOVO) Retorno do caderno de erros
            loadDashboard(auth.currentUser);
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

// (Função auxiliar)
function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// (Sem alteração)
async function handleResetarDesempenho() {
    if (!confirm("Tem a certeza ABSOLUTA que quer resetar todo o seu progresso? Esta ação não pode ser desfeita e todas as suas estatísticas voltarão a zero.")) {
        return;
    }
    appContent.innerHTML = renderLoadingState(); 
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userDocRef = doc(db, 'users', user.uid);
        const progressoRef = collection(userDocRef, 'progresso');
        const querySnapshot = await getDocs(progressoRef);
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
        
        // (NOVO) Também apaga o caderno de erros
        const errosRef = collection(userDocRef, 'questoes_erradas');
        const errosSnapshot = await getDocs(errosRef);
        errosSnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);

        await updateDoc(userDocRef, {
            cicloIndex: 0,
            totalDiasEstudo: 0,
            sequenciaDias: 0
        });
        loadDashboard(user);
    } catch (error) {
        console.error("Erro ao resetar desempenho:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao resetar seu progresso: ${error.message}</p>`;
    }
}

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
async function handleStartStudySession(materia) { /* ...código omitido... */ 
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
            let returnButtonHtml = getVoltarButtonHtml(); 
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão de "${materia}" encontrada.</p>${returnButtonHtml}`;
            return;
        }
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data();
        if (quizReturnPath === 'menu') { 
            metaQuestoesDoDia = userData?.metaDiaria || 20;
        } else { 
            metaQuestoesDoDia = questoesArray.length;
        }
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Estudo: ${materia.replace('_', ' ')}`;
        renderQuiz(); 
    } catch (error) {
        console.error("Erro ao carregar questões do Firestore:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar questões: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleProximaQuestao() { /* ...código omitido... */ 
    quizIndexAtual++; 
    if (quizIndexAtual >= quizQuestoes.length || (quizReturnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia) ) {
        let textoFinal = `Você completou ${quizIndexAtual} questões de ${quizQuestoes[0].materia}.`;
        let textoBotao = "Voltar ao Estudo Livre"; 
        
        if (quizReturnPath === 'menu') { 
            textoFinal = `Você completou sua meta de ${metaQuestoesDoDia} questões de ${quizQuestoes[0].materia}!`;
            textoBotao = "Voltar ao Menu Principal";
        }
        if (quizReturnPath === 'simulados') {
            textoFinal = `Você completou o simulado de ${quizQuestoes.length} questões.`;
            textoBotao = "Voltar ao Menu de Simulados";
        }
        // (NOVO) Mensagem de conclusão do Caderno de Erros
        if (quizReturnPath === 'erros') {
            textoFinal = `Você completou sua revisão de ${quizQuestoes.length} questões.`;
            textoBotao = "Voltar ao Menu Principal";
        }

        if (cronometroInterval) clearInterval(cronometroInterval); 
        appContent.innerHTML = `
            <div class="text-center">
                <h1 class="text-3xl font-bold text-white mb-4">Sessão Concluída!</h1>
                <p class="text-gray-300 mb-8">${textoFinal}</p>
                <button data-action="sair-quiz" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">
                    ${textoBotao}
                </button>
            </div>
        `;
        if (quizReturnPath === 'menu') {
            try {
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
        renderQuiz();
    }
}

// ===============================================
// (ATUALIZADO) handleConfirmarResposta (Salva erros)
// ===============================================
async function handleConfirmarResposta() { 
    if (alternativaSelecionada === null) {
        alert('Por favor, selecione uma alternativa.');
        return;
    }
    if (respostaConfirmada) return; 
    respostaConfirmada = true;
    
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const correta = questaoAtual.correta;
    const acertou = alternativaSelecionada === correta;
    
    try {
        // 1. Salva o progresso (acerto/erro)
        await salvarProgresso(questaoAtual.materia, acertou);

        // 2. (NOVO) Se errou, salva no caderno de erros
        if (!acertou && questaoAtual.id) {
            const user = auth.currentUser;
            // Usamos o ID da própria questão como ID do documento
            // para evitar salvar a mesma questão errada várias vezes.
            const erroRef = doc(db, 'users', user.uid, 'questoes_erradas', questaoAtual.id);
            await setDoc(erroRef, questaoAtual);
        }

    } catch (error) {
        console.error("Erro ao salvar progresso ou erro:", error);
    }

    // 3. Mostra o gabarito visual
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

    // 4. Mostra o comentário
    const comentarioEl = document.getElementById('quiz-comentario');
    comentarioEl.innerHTML = `
        <h3 class="text-xl font-bold text-white mb-2">Gabarito & Comentário</h3>
        <p class="text-gray-300">${questaoAtual.comentario || 'Nenhum comentário disponível.'}</p>
    `;
    comentarioEl.classList.remove('hidden');

    // 5. Atualiza o botão
    const botaoConfirmar = document.getElementById('quiz-botao-confirmar');
    botaoConfirmar.textContent = 'Próxima Questão';
    botaoConfirmar.dataset.action = 'proxima-questao';
}
async function salvarProgresso(materia, acertou) { /* ...código omitido... */ 
    const user = auth.currentUser;
    if (!user) return; 
    const progressoRef = doc(db, 'users', user.uid, 'progresso', materia);
    await setDoc(progressoRef, {
        totalResolvidas: increment(1),
        totalAcertos: acertou ? increment(1) : increment(0)
    }, { merge: true });
}
async function handleStartSimulado(edicao) { /* ...código omitido... */ 
    appContent.innerHTML = renderLoadingState(); 
    try {
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("edicao", "==", edicao));
        const querySnapshot = await getDocs(q);
        const questoesArray = [];
        querySnapshot.forEach((doc) => { questoesArray.push(doc.data()); });
        if (questoesArray.length === 0) {
            let returnButtonHtml = getVoltarButtonHtml(); 
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão da "${edicao}" encontrada.</p>${returnButtonHtml}`;
            return;
        }
        metaQuestoesDoDia = questoesArray.length; 
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Simulado ${edicao}`; 
        renderQuiz(5 * 60 * 60); 
    } catch (error) {
        console.error("Erro ao carregar simulado:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar simulado: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleStartSimuladoAcertivo() { /* ...código omitido... */ 
    appContent.innerHTML = renderLoadingState(); 
    try {
        const themeCounts = new Map();
        const questionsByTheme = new Map();
        const questoesRef = collection(db, 'questoes');
        const querySnapshot = await getDocs(questoesRef);
        if (querySnapshot.empty) {
            let returnButtonHtml = getVoltarButtonHtml(); 
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão encontrada na base de dados.</p>${returnButtonHtml}`;
            return;
        }
        querySnapshot.forEach((doc) => {
            const questao = doc.data();
            const tema = questao.tema;
            if (tema) {
                const count = themeCounts.get(tema) || 0;
                themeCounts.set(tema, count + 1);
                const list = questionsByTheme.get(tema) || [];
                list.push(questao);
                questionsByTheme.set(tema, list);
            }
        });
        const sortedThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]);
        const simuladoQuestoes = [];
        for (const [tema, count] of sortedThemes) {
            const themeQuestions = questionsByTheme.get(tema);
            simuladoQuestoes.push(...themeQuestions);
            if (simuladoQuestoes.length >= 80) break; 
        }
        const finalExam = simuladoQuestoes.slice(0, 80); 
        metaQuestoesDoDia = finalExam.length; 
        quizQuestoes = finalExam; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = 'Simulado Acertivo'; 
        renderQuiz(5 * 60 * 60); 
    } catch (error) {
        console.error("Erro ao gerar Simulado Acertivo:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao gerar simulado: ${error.message}</p>${returnButtonHtml}`;
    }
}

// ===============================================
// (NOVA FUNÇÃO) handleStartCadernoErros
// ===============================================
async function handleStartCadernoErros() {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const user = auth.currentUser;
        const questoesRef = collection(db, 'users', user.uid, 'questoes_erradas');
        const querySnapshot = await getDocs(questoesRef);
        
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push(doc.data());
        });

        if (questoesArray.length === 0) {
            let returnButtonHtml = getVoltarButtonHtml(); 
            appContent.innerHTML = `
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-white mb-4">Parabéns!</h2>
                    <p class="text-gray-300 mb-6">Seu caderno de erros está vazio. Você ainda não errou nenhuma questão.</p>
                    ${returnButtonHtml}
                </div>
            `;
            return;
        }
        
        metaQuestoesDoDia = questoesArray.length; // A meta é revisar todos os erros
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Caderno de Erros`;
        renderQuiz(); 
    } catch (error) {
        console.error("Erro ao carregar caderno de erros:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar seus erros: ${error.message}</p>${returnButtonHtml}`;
    }
}

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

// ===============================================
// (ATUALIZADO) getVoltarButtonHtml (adiciona 'erros')
// ===============================================
function getVoltarButtonHtml() {
    if (quizReturnPath === 'free-study') {
        return `<button data-action="show-free-study" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Estudo Livre</button>`;
    } else if (quizReturnPath === 'simulados') {
         return `<button data-action="show-simulados-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar aos Simulados</button>`;
    } else if (quizReturnPath === 'erros') {
         return `<button data-action="student-voltar-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>`;
    } else {
         return `<button data-action="student-voltar-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>`;
    }
}
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

// ===============================================
// (ATUALIZADO) renderStudentDashboard_Menu (Adiciona Card de Erros)
// ===============================================
async function renderStudentDashboard_Menu(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const cardHover = "hover:bg-gray-700 hover:border-blue-400 transition duration-300 cursor-pointer";

    // --- (LÓGICA DE STATS) ---
    const progressoRef = collection(db, 'users', auth.currentUser.uid, 'progresso');
    const progressoSnapshot = await getDocs(progressoRef);
    let totalResolvidasGlobal = 0;
    let totalAcertosGlobal = 0;
    let materiaStatsHtml = ''; 

    progressoSnapshot.forEach((doc) => {
        const materia = doc.id;
        const data = doc.data();
        const resolvidas = data.totalResolvidas || 0;
        const acertos = data.totalAcertos || 0;
        totalResolvidasGlobal += resolvidas;
        totalAcertosGlobal += acertos;
        const taxa = (resolvidas > 0) ? ((acertos / resolvidas) * 100).toFixed(0) : 0;

        materiaStatsHtml += `
            <div class="mb-3">
                <div class="flex justify-between mb-1">
                    <span class="text-sm font-medium text-blue-300 capitalize">${materia.replace('_', ' ')}</span>
                    <span class="text-sm font-medium text-gray-300">${taxa}% (${acertos}/${resolvidas})</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2.5">
                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${taxa}%"></div>
                </div>
            </div>
        `;
    });

    const taxaAcertoGlobal = (totalResolvidasGlobal > 0) 
        ? ((totalAcertosGlobal / totalResolvidasGlobal) * 100).toFixed(0) 
        : 0;
    // --- (FIM DA LÓGICA DE STATS) ---

    const totalDias = userData.totalDiasEstudo || 0;
    const sequencia = userData.sequenciaDias || 0;

    return `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        
        <div class="grid md:grid-cols-4 gap-6 mb-8">
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3><p class="text-3xl font-bold text-white mt-2">${totalResolvidasGlobal}</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3><p class="text-3xl font-bold text-white mt-2">${taxaAcertoGlobal}%</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Total de Dias</h3><p class="text-3xl font-bold text-white mt-2">${totalDias}</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Sequência 🔥</h3><p class="text-3xl font-bold text-white mt-2">${sequencia}</p></div>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
            <div class="md:col-span-2">
                <h2 class="text-2xl font-bold text-white mb-6">Escolha seu modo de estudo:</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div data-action="show-guided-planner" class="${cardStyle} ${cardHover}"><h3 class="text-2xl font-bold text-blue-400 mb-3">Planner Guiado</h3><p class="text-gray-300">Siga um ciclo de estudos automático com metas diárias.</p></div>
                    <div data-action="show-free-study" class="${cardStyle} ${cardHover}"><h3 class="text-2xl font-bold text-white mb-3">Estudo Livre</h3><p class="text-gray-300">Escolha qualquer matéria, a qualquer momento, sem metas.</p></div>
                    <div data-action="show-simulados-menu" class="${cardStyle} ${cardHover}"><h3 class="text-2xl font-bold text-blue-400 mb-3">Simulados</h3><p class="text-gray-300">Faça provas completas por edição ou por temas.</p></div>
                    
                    <div data-action="show-caderno-erros" class="${cardStyle} ${cardHover} border-red-500 hover:border-red-400">
                        <h3 class="text-2xl font-bold text-red-400 mb-3">Caderno de Erros</h3>
                        <p class="text-gray-300">Revise apenas as questões que você já errou.</p>
                    </div>

                </div>
            </div>
            <div class="${cardStyle} md:col-span-1">
                <h3 class="text-2xl font-bold text-white mb-6">Seu Desempenho</h3>
                <div class="space-y-4">
                    ${materiaStatsHtml || '<p class="text-gray-400">Responda a algumas questões para ver seu progresso aqui.</p>'}
                </div>
                
                <div class="mt-6 border-t border-gray-700 pt-4">
                    <button data-action="resetar-desempenho" 
                            class="w-full text-sm text-center text-red-400 hover:text-red-300 transition">
                        Resetar todo o desempenho
                    </button>
                </div>
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
                    class="w-full md:w-auto p-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition duration-300">
                Iniciar ${metaDoDia} Questões de ${materiaDoDia.replace('_', ' ')}
            </button>
        </div>
    `;
}
// (Sem alteração)
function renderFreeStudyDashboard(userData) { /* ...código omitido... */ 
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const materias = ["etica", "civil", "processo_civil", "penal", "processo_penal", "constitucional", "administrativo", "tributario", "empresarial", "trabalho", "processo_trabalho"];
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
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
                <div data-action="start-simulado-acertivo" class="${cardStyle} ${cardHover}">
                    <h3 class="text-xl font-bold text-blue-400 mb-4">Simulado Acertivo</h3>
                    <p class="text-gray-400">Um simulado de 80 questões focado apenas nos temas mais cobrados.</p>
                </div>
            </div>
        </div>
    `;
}
// (Sem alteração)
function renderQuiz(duracaoSegundos = null) {
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const alternativaStyle = "p-4 bg-gray-700 rounded-lg text-white hover:bg-gray-600 cursor-pointer transition border border-transparent";
    const metaDoQuiz = (quizReturnPath === 'menu') ? metaQuestoesDoDia : quizQuestoes.length;
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
        <h2 class="text-2xl font-bold text-white mb-2 capitalize">${quizTitle}</h2>
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
            <button id="quiz-botao-sair" data-action="sair-quiz" class="bg-gray-600 text-white font-semibold py-2 px-6 rounded hover:bg-gray-700 transition">Sair</button>
            <button id="quiz-botao-confirmar" data-action="confirmar-resposta" class="bg-blue-600 text-white font-semibold py-2 px-6 rounded hover:bg-blue-700 transition">Confirmar Resposta</button>
        </div>
    `;
    if (duracaoSegundos) {
        startCronometro(duracaoSegundos);
    }
}
