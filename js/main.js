/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO 5.34 - CORREÇÃO CRÍTICA DO 'currentUser')
 *
 * NOVIDADES:
 * - Corrigido o bug 'auth.currentUser.uid is null'
 * que impedia o dashboard do aluno de carregar.
 * - A função 'loadDashboard' agora passa o 'user' para
 * 'renderStudentDashboard_Menu'
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db } from './firebase-config.js'; 
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc,
    setDoc, increment,
    arrayUnion
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
const TODAS_MATERIAS = [
    "etica", "civil", "processo_civil", "penal", "processo_penal", 
    "constitucional", "administrativo", "tributario", "empresarial", 
    "trabalho", "processo_trabalho"
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
let anotacaoDebounceTimer = null; 

let quizReport = { acertos: 0, erros: 0, total: 0 };
let quizTempoRestante = null; 


// --- [ PARTE 5: LISTENER DE AUTENTICAÇÃO ] ---
// (Removido - O auth.js agora controla tudo)


// --- [ PARTE 6: LÓGICA DE CARREGAMENTO DO DASHBOARD ] ---
export async function loadDashboard(user) { // <--- O 'user' entra aqui
    if (cronometroInterval) clearInterval(cronometroInterval); 
    quizTempoRestante = null; 
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            let userData = userDoc.data();
            const today = new Date();
            const hojeStr = getFormattedDate(today); 
            
            const ultimoLoginData = userData.ultimoLogin ? userData.ultimoLogin.toDate() : null;
            const ultimoLoginStr = ultimoLoginData ? getFormattedDate(ultimoLoginData) : null;

            if (ultimoLoginStr !== hojeStr) {
                const ontem = new Date();
                ontem.setDate(ontem.getDate() - 1);
                const ontemStr = getFormattedDate(ontem);

                const totalDiasEstudo = (userData.totalDiasEstudo || 0) + 1;
                let sequenciaDias = 1; 
                
                if (ultimoLoginStr === ontemStr) {
                    sequenciaDias = (userData.sequenciaDias || 0) + 1;
                }
                
                const monthId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
                const diaDoMes = today.getDate(); 
                const studyLogRef = doc(db, 'users', user.uid, 'dias_estudo', monthId);
                
                await setDoc(studyLogRef, { 
                    dias: arrayUnion(diaDoMes) 
                }, { merge: true });

                const novosDados = {
                    totalDiasEstudo: totalDiasEstudo,
                    sequenciaDias: sequenciaDias,
                    ultimoLogin: today 
                };
                await updateDoc(userDocRef, novosDados);
                userData = { ...userData, ...novosDados };
            }

            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                // (CORRIGIDO)
                // 1. Passa o 'userData' E o 'user' (com o uid)
                const { dashboardHtml, chartLabels, chartData } = await renderStudentDashboard_Menu(userData, user); 
                
                // 2. Desenha o HTML
                appContent.innerHTML = dashboardHtml;
                
                // 3. Desenha o gráfico, SE houver dados
                if (chartLabels.length > 0) {
                    setTimeout(() => {
                        renderPerformanceChart(chartLabels, chartData);
                    }, 1);
                }
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
    
    const actionButton = e.target.closest('[data-action]');

    const alternativaEl = e.target.closest('[data-alternativa]');
    if (alternativaEl && !respostaConfirmada) {
        if (!actionButton) { 
            alternativaSelecionada = alternativaEl.dataset.alternativa;
            document.querySelectorAll('[data-alternativa]').forEach(el => {
                el.classList.remove('bg-blue-700', 'border-blue-400');
                el.classList.add('bg-gray-700');
            });
            alternativaEl.classList.add('bg-blue-700', 'border-blue-400');
            alternativaEl.classList.remove('bg-gray-700');
            return; 
        }
    }

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

    // --- Ações de Aluno (Menus) ---
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
    if (action === 'show-caderno-erros') {
        quizReturnPath = 'erros';
        await renderCadernoErrosMenu(); 
    }
    if (action === 'show-caderno-acertos') {
        quizReturnPath = 'acertos';
        await renderCadernoAcertosMenu(); 
    }
    if (action === 'show-anotacoes-menu') {
        appContent.innerHTML = renderAnotacoesMenu();
    }
    if (action === 'show-anotacoes-editor') {
        const materia = actionButton.dataset.materia;
        await renderAnotacoesEditor(materia);
    }
    if (action === 'student-voltar-menu') {
        loadDashboard(auth.currentUser); 
    }

    // --- Ações de Aluno (Iniciar Quizzes) ---
    if (action === 'start-study-session') {
        const materia = actionButton.dataset.materia;
        await handleStartStudySession(materia);
    }
    if (action === 'start-simulado-edicao-dropdown') {
        const selectEl = document.getElementById('select-simulado-edicao');
        const valor = selectEl.value; 
        
        if (valor) { 
            const [num, rom] = valor.split(','); 
            await handleStartSimulado(num, rom); 
        }
    }
    if (action === 'start-simulado-assertivo') { 
        await handleStartSimuladoAssertivo();
    }
    if (action === 'start-quiz-erros') {
        await handleStartCadernoErros();
    }
    if (action === 'start-quiz-acertos') {
        await handleStartCadernoAcertos();
    }
    

    // --- Ações de Aluno (Resetar) ---
    if (action === 'resetar-desempenho') {
        await handleResetarDesempenho(); 
    }
    if (action === 'limpar-caderno-erros') {
        await handleLimparCadernoErros();
    }
    if (action === 'limpar-caderno-acertos') {
        await handleLimparCadernoAcertos();
    }


    // --- Ações do Quiz ---
    if (action === 'confirmar-resposta') { await handleConfirmarResposta(); }
    if (action === 'proxima-questao') { await handleProximaQuestao(); }
    if (action === 'sair-quiz') {
        if (quizReturnPath === 'free-study') {
            appContent.innerHTML = renderFreeStudyDashboard(auth.currentUser.uid);
        } else if (quizReturnPath === 'simulados') {
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
appContent.addEventListener('input', (e) => {
    if (e.target.id === 'anotacoes-textarea') {
        const statusEl = document.getElementById('anotacoes-status');
        const materia = e.target.dataset.materia;
        const conteudo = e.target.value;
        statusEl.textContent = 'A guardar...';
        
        if (anotacaoDebounceTimer) clearTimeout(anotacaoDebounceTimer);
        
        anotacaoDebounceTimer = setTimeout(async () => {
            await handleSalvarAnotacao(materia, conteudo);
            statusEl.textContent = 'Guardado!';
        }, 1500);
    }
});


// --- [ PARTE 8: LÓGICA DE ADMIN ] ---
async function handleCreateQuestionSubmit(form) {
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
        const questaoRef = doc(db, 'questoes', questaoData.id);
        await setDoc(questaoRef, questaoData);

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


// --- [ PARTE 9: LÓGICA DE ALUNO ] ---

function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function handleResetarDesempenho() {
    if (!confirm("Tem a certeza ABSOLUTA que quer resetar todo o seu progresso? Esta ação não pode ser desfeita e todas as suas estatísticas voltarão a zero.")) {
        return;
    }
    appContent.innerHTML = renderLoadingState(); 
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userDocRef = doc(db, 'users', user.uid);
        
        const deletePromises = [];

        const progressoRef = collection(userDocRef, 'progresso');
        const progressoSnapshot = await getDocs(progressoRef);
        progressoSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        
        const errosRef = collection(userDocRef, 'questoes_erradas');
        const errosSnapshot = await getDocs(errosRef);
        errosSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));

        const anotacoesRef = collection(userDocRef, 'anotacoes');
        const anotacoesSnapshot = await getDocs(anotacoesRef);
        anotacoesSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        
        const acertosRef = collection(userDocRef, 'questoes_acertadas');
        const acertosSnapshot = await getDocs(acertosRef);
        acertosSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        
        const diasEstudoRef = collection(userDocRef, 'dias_estudo');
        const diasEstudoSnapshot = await getDocs(diasEstudoRef);
        diasEstudoSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));

        await Promise.all(deletePromises);

        await updateDoc(userDocRef, {
            cicloIndex: 0,
            totalDiasEstudo: 0,
            sequenciaDias: 0,
            ultimoLogin: null
        });
        
        loadDashboard(user);
    } catch (error) {
        console.error("Erro ao resetar desempenho:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao resetar seu progresso: ${error.message}</p>`;
    }
}

async function handleLimparCadernoErros() {
    if (!confirm("Tem a certeza que quer limpar o seu Caderno de Erros? Todas as questões erradas serão removidas permanentemente.")) {
        return;
    }
    appContent.innerHTML = renderLoadingState();
    try {
        const user = auth.currentUser;
        const userDocRef = doc(db, 'users', user.uid);
        const errosRef = collection(userDocRef, 'questoes_erradas');
        const errosSnapshot = await getDocs(errosRef);
        
        const deletePromises = [];
        errosSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        await Promise.all(deletePromises);

        await renderCadernoErrosMenu();
    } catch (error) {
        console.error("Erro ao limpar caderno de erros:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao limpar o caderno: ${error.message}</p>`;
    }
}

async function handleLimparCadernoAcertos() {
    if (!confirm("Tem a certeza que quer limpar o seu Caderno de Acertos?")) {
        return;
    }
    appContent.innerHTML = renderLoadingState();
    try {
        const user = auth.currentUser;
        const userDocRef = doc(db, 'users', user.uid);
        const acertosRef = collection(userDocRef, 'questoes_acertadas');
        const acertosSnapshot = await getDocs(acertosRef);
        
        const deletePromises = [];
        acertosSnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        await Promise.all(deletePromises);

        await renderCadernoAcertosMenu();
    } catch (error) {
        console.error("Erro ao limpar caderno de acertos:", error);
        appContent.innerHTML = `<p class="text-red-400">Erro ao limpar o caderno: ${error.message}</p>`;
    }
}

async function handleSavePlannerSetup(form) {
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
async function handleStartStudySession(materia) {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("materia", "==", materia));
        const querySnapshot = await getDocs(q);
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push({ ...doc.data(), docId: doc.id });
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
        quizReport = { acertos: 0, erros: 0, total: 0 };
        quizTempoRestante = null; 
        renderQuiz(); 
    } catch (error) {
        console.error("Erro ao carregar questões do Firestore:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar questões: ${error.message}</p>${returnButtonHtml}`;
    }
}

async function finalizarQuiz() {
    if (cronometroInterval) clearInterval(cronometroInterval); 
    quizTempoRestante = null;
    let textoFinal = `Você completou ${quizReport.total} questões.`;
    let textoBotao = "Voltar";
    
    if (quizReturnPath === 'menu') { 
        textoFinal = `Você completou sua meta de ${metaQuestoesDoDia} questões!`;
        textoBotao = "Voltar ao Menu Principal";
        try {
            const user = auth.currentUser;
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            const dadosAtuais = userDoc.data();
            let novoIndex = (dadosAtuais.cicloIndex || 0) + 1;
            if (novoIndex >= CICLO_DE_ESTUDOS.length) { novoIndex = 0; }
            await updateDoc(userDocRef, { cicloIndex: novoIndex });
        } catch (error) { console.error("Erro ao atualizar o ciclo:", error); }
    }
    if (quizReturnPath === 'simulados') {
        textoFinal = `Você completou o simulado.`;
        textoBotao = "Voltar ao Menu de Simulados";
    }
    if (quizReturnPath === 'erros') {
        textoFinal = `Você completou sua revisão de ${quizReport.total} questões.`;
        textoBotao = "Voltar ao Menu Principal";
    }
    if (quizReturnPath === 'acertos') {
        textoFinal = `Você completou sua revisão de ${quizReport.total} questões.`;
        textoBotao = "Voltar ao Menu Principal";
    }
    if (quizReturnPath === 'free-study') {
         textoFinal = `Você completou ${quizReport.total} questões.`;
         textoBotao = "Voltar ao Estudo Livre";
    }
    appContent.innerHTML = renderQuizReport(quizReport, textoFinal, textoBotao);
}
async function handleProximaQuestao() {
    quizIndexAtual++; 
    const quizTerminou = quizIndexAtual >= quizQuestoes.length || (quizReturnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia);
    if (quizTerminou) {
        finalizarQuiz(); 
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuiz(); 
    }
}
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
    quizReport.total++;
    if (acertou) {
        quizReport.acertos++;
    } else {
        quizReport.erros++;
    }
    try {
        await salvarProgresso(questaoAtual.materia, acertou);
        const user = auth.currentUser;
        const questaoId = questaoAtual.docId || questaoAtual.id; 
        if (questaoId) {
            const erroRef = doc(db, 'users', user.uid, 'questoes_erradas', questaoId);
            const acertoRef = doc(db, 'users', user.uid, 'questoes_acertadas', questaoId);
            if (!acertou) {
                await setDoc(erroRef, questaoAtual);
                await deleteDoc(acertoRef); 
            } else {
                await setDoc(acertoRef, questaoAtual);
                await deleteDoc(erroRef);
            }
        }
    } catch (error) {
        console.error("Erro ao salvar progresso/erro/acerto:", error);
    }
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
async function salvarProgresso(materia, acertou) {
    const user = auth.currentUser;
    if (!user) return; 
    const progressoRef = doc(db, 'users', user.uid, 'progresso', materia);
    await setDoc(progressoRef, {
        totalResolvidas: increment(1),
        totalAcertos: acertou ? increment(1) : increment(0)
    }, { merge: true });
}
async function handleStartSimulado(num, rom) { 
    appContent.innerHTML = renderLoadingState(); 
    const variacoes = [ `OAB-${num}`, num, `OAB-${rom}`, rom ];
    try {
        const questoesRef = collection(db, 'questoes');
        const q = query(questoesRef, where("edicao", "in", variacoes));
        const querySnapshot = await getDocs(q);
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push({ ...doc.data(), docId: doc.id });
        });
        if (questoesArray.length === 0) {
            let returnButtonHtml = getVoltarButtonHtml(); 
            appContent.innerHTML = `<p class="text-gray-400">Nenhuma questão encontrada para o Exame ${rom}.</p>${returnButtonHtml}`;
            return;
        }
        metaQuestoesDoDia = questoesArray.length; 
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Simulado Exame ${rom}`; 
        quizReport = { acertos: 0, erros: 0, total: 0 };
        quizTempoRestante = 5 * 60 * 60; 
        renderQuiz(); 
        startCronometro(); 
    } catch (error) {
        console.error("Erro ao carregar simulado:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar simulado: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleStartSimuladoAssertivo() {
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
            const questao = { ...doc.data(), docId: doc.id };
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
        quizTitle = 'Simulado Assertivo';
        quizReport = { acertos: 0, erros: 0, total: 0 };
        quizTempoRestante = 5 * 60 * 60; 
        renderQuiz(); 
        startCronometro();
    } catch (error) {
        console.error("Erro ao gerar Simulado Assertivo:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao gerar simulado: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleStartCadernoErros() {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const user = auth.currentUser;
        const questoesRef = collection(db, 'users', user.uid, 'questoes_erradas');
        const querySnapshot = await getDocs(questoesRef);
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push({ ...doc.data(), docId: doc.id });
        });
        metaQuestoesDoDia = questoesArray.length;
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Caderno de Erros`;
        quizReport = { acertos: 0, erros: 0, total: 0 };
        quizTempoRestante = null;
        renderQuiz(); 
    } catch (error) {
        console.error("Erro ao carregar caderno de erros:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar os seus erros: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleStartCadernoAcertos() {
    appContent.innerHTML = renderLoadingState(); 
    try {
        const user = auth.currentUser;
        const questoesRef = collection(db, 'users', user.uid, 'questoes_acertadas');
        const querySnapshot = await getDocs(questoesRef);
        const questoesArray = [];
        querySnapshot.forEach((doc) => {
            questoesArray.push({ ...doc.data(), docId: doc.id });
        });
        metaQuestoesDoDia = questoesArray.length;
        quizQuestoes = questoesArray; 
        quizIndexAtual = 0;        
        alternativaSelecionada = null;
        respostaConfirmada = false;
        quizTitle = `Caderno de Acertos`;
        quizReport = { acertos: 0, erros: 0, total: 0 };
        quizTempoRestante = null;
        renderQuiz(); 
    } catch (error) {
        console.error("Erro ao carregar caderno de acertos:", error);
        let returnButtonHtml = getVoltarButtonHtml(); 
        appContent.innerHTML = `<p class="text-red-400">Erro ao carregar os seus acertos: ${error.message}</p>${returnButtonHtml}`;
    }
}
async function handleSalvarAnotacao(materia, conteudo) {
    if (!materia) return;
    try {
        const user = auth.currentUser;
        const anotacaoRef = doc(db, 'users', user.uid, 'anotacoes', materia);
        await setDoc(anotacaoRef, {
            materia: materia,
            conteudo: conteudo,
            atualizadoEm: new Date()
        }, { merge: true });
    } catch (error) {
        console.error("Erro ao salvar anotação:", error);
        const statusEl = document.getElementById('anotacoes-status');
        if(statusEl) statusEl.textContent = "Erro ao guardar.";
    }
}
async function renderAnotacoesEditor(materia) {
    appContent.innerHTML = renderLoadingState();
    let conteudoAtual = "";
    try {
        const user = auth.currentUser;
        const anotacaoRef = doc(db, 'users', user.uid, 'anotacoes', materia);
        const docSnap = await getDoc(anotacaoRef);
        if (docSnap.exists()) {
            conteudoAtual = docSnap.data().conteudo || "";
        }
    } catch (error) {
        console.error("Erro ao carregar anotação:", error);
    }
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    appContent.innerHTML = `
        <button data-action="show-anotacoes-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar às Matérias</button>
        <div class="${cardStyle}">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white capitalize">
                    Anotações: ${materia.replace('_', ' ')}
                </h2>
                <span id="anotacoes-status" class="text-sm text-gray-400"></span>
            </div>
            <p class="text-gray-300 mb-4">
                Use o espaço abaixo para as suas anotações. O texto é guardado automaticamente.
            </p>
            <textarea id="anotacoes-textarea" data-materia="${materia}" rows="20"
                      class="w-full p-4 bg-gray-900 text-gray-200 rounded-md border border-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Escreva aqui os seus 'flashcards', resumos de artigos, mnemónicos, etc..."
            >${conteudoAtual}</textarea>
        </div>
    `;
}
function startCronometro() {
    if (cronometroInterval) clearInterval(cronometroInterval); 
    cronometroInterval = setInterval(() => {
        const cronometroEl = document.getElementById('quiz-cronometro');
        if (!cronometroEl) {
            clearInterval(cronometroInterval);
            return;
        }
        quizTempoRestante--; 
        const horas = Math.floor(quizTempoRestante / 3600);
        const minutos = Math.floor((quizTempoRestante % 3600) / 60);
        const segundos = quizTempoRestante % 60;
        cronometroEl.textContent = 
            `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        if (quizTempoRestante <= 0) {
            clearInterval(cronometroInterval);
            alert("Tempo esgotado! O seu simulado será finalizado.");
            finalizarQuiz(); 
        }
    }, 1000);
}

// --- [ PARTE 10: FUNÇÕES DE RENDERIZAÇÃO (HTML) ] ---
function getVoltarButtonHtml() {
    if (quizReturnPath === 'free-study') {
        return `<button data-action="show-free-study" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Estudo Livre</button>`;
    } else if (quizReturnPath === 'simulados') {
         return `<button data-action="show-simulados-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar aos Simulados</button>`;
    } else { 
         return `<button data-action="student-voltar-menu" class="mt-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>`;
    }
}
function renderLoadingState() {
    return `<p class="text-gray-400">A carregar...</p>`;
}
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
async function renderStudentDashboard_Menu(userData, user) { // (CORRIGIDO) Recebe o 'user'
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const menuItemStyle = "bg-gray-800 rounded-lg shadow-xl border border-gray-700 transition duration-300 ease-in-out transform hover:border-blue-400 hover:scale-[1.02] cursor-pointer";
    
    // (CORRIGIDO) Usa user.uid em vez de auth.currentUser.uid
    const progressoRef = collection(db, 'users', user.uid, 'progresso');
    const progressoSnapshot = await getDocs(progressoRef);
    let totalResolvidasGlobal = 0;
    let totalAcertosGlobal = 0;
    let chartLabels = [];
    let chartData = []; 

    progressoSnapshot.forEach((doc) => {
        const materia = doc.id;
        const data = doc.data();
        const resolvidas = data.totalResolvidas || 0;
        const acertos = data.totalAcertos || 0;
        totalResolvidasGlobal += resolvidas;
        totalAcertosGlobal += acertos;
        const taxa = (resolvidas > 0) ? ((acertos / resolvidas) * 100).toFixed(0) : 0;
        if (resolvidas > 0) {
            chartLabels.push(materia.replace(/_/g, ' '));
            chartData.push(taxa);
        }
    });

    const taxaAcertoGlobal = (totalResolvidasGlobal > 0) 
        ? ((totalAcertosGlobal / totalResolvidasGlobal) * 100).toFixed(0) 
        : 0;
    const totalDias = userData.totalDiasEstudo || 0;
    const sequencia = userData.sequenciaDias || 0;

    let desempenhoHtml = '';
    if (chartLabels.length > 0) {
        desempenhoHtml = `<canvas id="performanceChart"></canvas>`;
    } else {
        desempenhoHtml = `<p class="text-gray-400">Responda a algumas questões para ver o seu progresso aqui.</p>`;
    }

    // (NOVO) Busca os dados do calendário
    const today = new Date();
    const monthId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const studyLogRef = doc(db, 'users', user.uid, 'dias_estudo', monthId);
    const studyLogDoc = await getDoc(studyLogRef);
    let diasEstudados = [];
    if (studyLogDoc.exists()) {
        diasEstudados = studyLogDoc.data().dias || [];
    }
    const calendarioHtml = renderCalendarioHTML(today.getFullYear(), today.getMonth(), diasEstudados);

    const dashboardHtml = `
        <h1 class="text-3xl font-bold text-white mb-6">Olá, <span class="text-blue-400">${userData.nome}</span>!</h1>
        
        <div class="grid md:grid-cols-4 gap-6 mb-8">
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Questões Resolvidas</h3><p class="text-3xl font-bold text-white mt-2">${totalResolvidasGlobal}</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Taxa de Acerto</h3><p class="text-3xl font-bold text-white mt-2">${taxaAcertoGlobal}%</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Total de Dias</h3><p class="text-3xl font-bold text-white mt-2">${totalDias}</p></div>
            <div class="${cardStyle}"><h3 class="text-sm font-medium text-gray-400 uppercase">Sequência 🔥</h3><p class="text-3xl font-bold text-white mt-2">${sequencia}</p></div>
        </div>

        <div class="${cardStyle} mb-8">
            <h3 class="text-2xl font-bold text-white mb-4">Calendário de Progresso (Este Mês)</h3>
            ${calendarioHtml}
        </div>

        <div class="grid md:grid-cols-3 gap-6">
            <div class="md:col-span-2">
                <h2 class="text-2xl font-bold text-white mb-6">O que vamos fazer hoje?</h2>
                <div class="space-y-6">
                    <div data-action="show-guided-planner" class="${menuItemStyle} p-6 flex items-center">
                        <div class="mr-6 flex-shrink-0">
                            <svg class="w-12 h-12 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Z" /></svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-blue-400 mb-1">Planner Guiado</h3>
                            <p class="text-gray-300">Siga um ciclo de estudos automático com metas diárias.</p>
                        </div>
                    </div>
                    <div data-action="show-caderno-acertos" class="${menuItemStyle} p-6 flex items-center border-green-500 hover:border-green-400">
                        <div class="mr-6 flex-shrink-0">
                            <svg class="w-12 h-12 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-green-400 mb-1">Caderno de Acertos</h3>
                            <p class="text-gray-300">Revise as questões que você acertou para reforçar o conhecimento.</p>
                        </div>
                    </div>
                    <div data-action="show-caderno-erros" class="${menuItemStyle} p-6 flex items-center border-red-500 hover:border-red-400">
                        <div class="mr-6 flex-shrink-0">
                            <svg class="w-12 h-12 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-red-400 mb-1">Caderno de Erros</h3>
                            <p class="text-gray-300">Revise apenas as questões que você já errou.</p>
                        </div>
                    </div>
                    <div data-action="show-anotacoes-menu" class="${menuItemStyle} p-6 flex items-center border-yellow-500 hover:border-yellow-400">
                        <div class="mr-6 flex-shrink-0">
                            <svg class="w-12 h-12 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-yellow-400 mb-1">Caderno de Anotações</h3>
                            <p class="text-gray-300">Crie e reveja as suas anotações pessoais por matéria.</p>
                        </div>
                    </div>
                    <div class="grid md:grid-cols-2 gap-6">
                        <div data-action="show-free-study" class="${menuItemStyle} p-6 flex items-center">
                            <div class="mr-5 flex-shrink-0">
                                <svg class="w-10 h-10 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white mb-1">Estudo Livre</h3>
                                <p class="text-gray-400 text-sm">Escolha qualquer matéria.</p>
                            </div>
                        </div>
                        <div data-action="show-simulados-menu" class="${menuItemStyle} p-6 flex items-center">
                            <div class="mr-5 flex-shrink-0">
                                <svg class="w-10 h-10 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white mb-1">Simulados</h3>
                                <p class="text-gray-400 text-sm">Faça provas completas.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="${cardStyle} md:col-span-1">
                <h3 class="text-2xl font-bold text-white mb-6">Seu Desempenho</h3>
                <div class="space-y-4">
                    ${desempenhoHtml}
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
    
    // Retorna o HTML E os dados para o loadDashboard
    return { dashboardHtml, chartLabels, chartData };
}

async function renderPerformanceChart(labels, data) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return; 

    let chartStatus = Chart.getChart("performanceChart"); 
    if (chartStatus != undefined) {
        chartStatus.destroy();
    }

    new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)), 
            datasets: [{
                label: 'Taxa de Acerto (%)',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)', 
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100, 
                    ticks: {
                        color: '#9ca3af' 
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' 
                    }
                },
                y: {
                    ticks: {
                        color: '#e5e7eb' 
                    },
                    grid: {
                        display: false 
                    }
                }
            },
            plugins: {
                legend: {
                    display: false 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Acerto: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
}


function renderPlanner_TarefaDoDia(userData) {
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
                A sua meta é resolver ${metaDoDia} questões.
            </p>
            <button data-action="start-study-session" data-materia="${materiaDoDia}"
                    class="w-full md:w-auto p-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition duration-300">
                Iniciar ${metaDoDia} Questões de ${materiaDoDia.replace('_', ' ')}
            </button>
        </div>
    `;
}
function renderAnotacoesMenu() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Caderno de Anotações</h2>
            <p class="text-gray-300 mb-6">Selecione uma matéria para ver ou editar as suas anotações:</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${TODAS_MATERIAS.map(materia => `
                    <button data-action="show-anotacoes-editor" data-materia="${materia}"
                            class="p-4 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition duration-300 capitalize">
                        ${materia.replace('_', ' ')}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}
function renderFreeStudyDashboard(userData) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Estudo Livre</h2>
            <p class="text-gray-300 mb-6">Selecione uma matéria para iniciar (sem meta de questões):</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${TODAS_MATERIAS.map(materia => `
                    <button data-action="start-study-session" data-materia="${materia}"
                            class="p-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 capitalize">
                        ${materia.replace('_', ' ')}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}
function renderPlannerSetupForm() {
    const cardStyle = "bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle} max-w-lg mx-auto">
            <h2 class="text-2xl font-bold text-white mb-4">Vamos configurar a sua meta</h2>
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
function renderCreateQuestionForm() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const inputStyle = "w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
    const labelStyle = "block text-sm font-medium text-gray-300";
    return `
        <button data-action="admin-voltar-painel" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Painel</button>
        <div class="${cardStyle}"><h2 class="text-2xl font-bold text-white mb-6">Criar Nova Questão</h2>
            <form id="form-create-question" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label for="materia" class="${labelStyle}">Matéria (ex: etica, civil)</label><input type="text" id="materia" name="materia" required class="${inputStyle}"></div>
                    <div><label for="edicao" class="${labelStyle}">Edição (ex: OAB-XXXI ou XXXI)</label><input type="text" id="edicao" name="edicao" required class="${inputStyle}"></div>
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
                listHtml += `
                    <div id="item-${docId}" class="p-4 bg-gray-900 rounded-lg flex items-center justify-between">
                        <div>
                            <span class="text-sm font-bold uppercase text-blue-400">${questao.materia} | ${questao.edicao || 'N/A'}</span>
                            <p class="text-white">${questao.enunciado.substring(0, 80)}...</p>
                            <p class="text-xs text-gray-400 mt-1">Tema: ${questao.tema || 'Não definido'} | ID: ${docId}</p>
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
function renderSimuladosMenu() {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const cardHover = "hover:bg-gray-700 hover:border-blue-400 transition duration-300 cursor-pointer";
    const selectStyle = "w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-blue-500";
    const edicoes = [
        { display: "XXXVIII", num: "38", rom: "XXXVIII" }, { display: "XXXVII", num: "37", rom: "XXXVII" },
        { display: "XXXVI", num: "36", rom: "XXXVI" }, { display: "XXXV", num: "35", rom: "XXXV" },
        { display: "XXXIV", num: "34", rom: "XXXIV" }, { display: "XXXIII", num: "33", rom: "XXXIII" },
        { display: "XXXII", num: "32", rom: "XXXII" }, { display: "XXXI", num: "31", rom: "XXXI" },
        { display: "XXX", num: "30", rom: "XXX" }, { display: "XXIX", num: "29", rom: "XXIX" },
        { display: "XXVIII", num: "28", rom: "XXVIII" }, { display: "XXVII", num: "27", rom: "XXVII" },
        { display: "XXVI", num: "26", rom: "XXVI" }, { display: "XXV", num: "25", rom: "XXV" },
        { display: "XXIV", num: "24", rom: "XXIV" }, { display: "XXIII", num: "23", rom: "XXIII" },
        { display: "XXII", num: "22", rom: "XXII" }, { display: "XXI", num: "21", rom: "XXI" },
        { display: "XX", num: "20", rom: "XX" }, { display: "XIX", num: "19", rom: "XIX" },
        { display: "XVIII", num: "18", rom: "XVIII" }, { display: "XVII", num: "17", rom: "XVII" },
        { display: "XVI", num: "16", rom: "XVI" }, { display: "XV", num: "15", rom: "XV" },
        { display: "XIV", num: "14", rom: "XIV" }, { display: "XIII", num: "13", rom: "XIII" },
        { display: "XII", num: "12", rom: "XII" }, { display: "XI", num: "11", rom: "XI" },
        { display: "X", num: "10", rom: "X" }, { display: "IX", num: "9", rom: "IX" },
        { display: "VIII", num: "8", rom: "VIII" }, { display: "VII", num: "7", rom: "VII" },
        { display: "VI", num: "6", rom: "VI" }, { display: "V", num: "5", rom: "V" }
    ];
    return `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-2xl font-bold text-white mb-6">Simulados</h2>
            <p class="text-gray-300 mb-6">Escolha um tipo de simulado para iniciar:</p>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="${cardStyle}">
                    <h3 class="text-xl font-bold text-blue-400 mb-4">Por Edição Anterior</h3>
                    <p class="text-gray-400 mb-4">Selecione uma prova para começar:</p>
                    <div class="space-y-4">
                        <select id="select-simulado-edicao" class="${selectStyle}">
                            <option value="">Selecione uma edição...</option>
                            ${edicoes.map(ed => `
                                <option value="${ed.num},${ed.rom}">Exame ${ed.display}</option>
                            `).join('')}
                        </select>
                        <button data-action="start-simulado-edicao-dropdown"
                                class="w-full p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                            Iniciar Simulado
                        </button>
                    </div>
                </div>
                <div data-action="start-simulado-assertivo" class="${cardStyle} ${cardHover}">
                    <h3 class="text-xl font-bold text-blue-400 mb-4">Simulado Assertivo</h3>
                    <p class="text-gray-400">Um simulado de 80 questões focado apenas nos temas mais cobrados.</p>
                </div>
            </div>
        </div>
    `;
}
async function renderCadernoErrosMenu() {
    appContent.innerHTML = renderLoadingState();
    let numErros = 0;
    try {
        const user = auth.currentUser;
        const questoesRef = collection(db, 'users', user.uid, 'questoes_erradas');
        const querySnapshot = await getDocs(questoesRef);
        numErros = querySnapshot.size;
    } catch (e) { console.error("Erro ao contar erros:", e); }
    const cardStyle = "bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 max-w-lg mx-auto text-center";
    let html = `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-3xl font-bold text-red-400 mb-4">Caderno de Erros</h2>
    `;
    if (numErros === 0) {
        html += `<p class="text-gray-300 text-lg">Parabéns! O seu caderno de erros está vazio.</p>`;
    } else {
        html += `
            <p class="text-gray-300 text-lg mb-6">
                Você tem <strong class="text-2xl text-white">${numErros}</strong> ${numErros === 1 ? 'questão' : 'questões'} para rever.
            </p>
            <button data-action="start-quiz-erros" class="w-full p-4 bg-red-600 text-white text-lg font-semibold rounded-lg hover:bg-red-700 transition duration-300 mb-4">
                Iniciar Revisão dos Erros
            </button>
            <button data-action="limpar-caderno-erros" class="w-full text-sm text-center text-gray-400 hover:text-red-400 transition">
                Limpar caderno de erros
            </button>
        `;
    }
    html += `</div>`;
    appContent.innerHTML = html;
}
async function renderCadernoAcertosMenu() {
    appContent.innerHTML = renderLoadingState();
    let numAcertos = 0;
    try {
        const user = auth.currentUser;
        const questoesRef = collection(db, 'users', user.uid, 'questoes_acertadas');
        const querySnapshot = await getDocs(questoesRef);
        numAcertos = querySnapshot.size;
    } catch (e) { console.error("Erro ao contar acertos:", e); }
    const cardStyle = "bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 max-w-lg mx-auto text-center";
    let html = `
        <button data-action="student-voltar-menu" class="mb-4 text-blue-400 hover:text-blue-300">&larr; Voltar ao Menu</button>
        <div class="${cardStyle}">
            <h2 class="text-3xl font-bold text-green-400 mb-4">Caderno de Acertos</h2>
    `;
    if (numAcertos === 0) {
        html += `<p class="text-gray-300 text-lg">O seu caderno de acertos está vazio. Comece a estudar!</p>`;
    } else {
        html += `
            <p class="text-gray-300 text-lg mb-6">
                Você tem <strong class="text-2xl text-white">${numAcertos}</strong> ${numAcertos === 1 ? 'questão' : 'questões'} acertadas para rever.
            </p>
            <button data-action="start-quiz-acertos" class="w-full p-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition duration-300 mb-4">
                Revisar Meus Acertos
            </button>
            <button data-action="limpar-caderno-acertos" class="w-full text-sm text-center text-gray-400 hover:text-red-400 transition">
                Limpar caderno de acertos
            </button>
        `;
    }
    html += `</div>`;
    appContent.innerHTML = html;
}
function renderQuiz() {
    const questaoAtual = quizQuestoes[quizIndexAtual];
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const alternativaStyle = "p-4 bg-gray-700 rounded-lg text-white hover:bg-gray-600 cursor-pointer transition border border-transparent";
    const metaDoQuiz = (quizReturnPath === 'menu') ? metaQuestoesDoDia : quizQuestoes.length;
    let cronometroHtml = '';
    if (quizTempoRestante !== null) {
        const horas = Math.floor(quizTempoRestante / 3600);
        const minutos = Math.floor((quizTempoRestante % 3600) / 60);
        const segundos = quizTempoRestante % 60;
        const tempoFormatado = 
            `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        cronometroHtml = `
            <div class="fixed top-20 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-blue-500 z-50">
                <span class="text-2xl font-mono" id="quiz-cronometro">${tempoFormatado}</span>
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
}
function renderQuizReport(report, textoFinal, textoBotao) {
    const cardStyle = "bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700";
    const taxaAcerto = (report.total > 0) ? ((report.acertos / report.total) * 100).toFixed(0) : 0;
    return `
        <div class="text-center max-w-lg mx-auto">
            <h1 class="text-3xl font-bold text-white mb-4">Sessão Concluída!</h1>
            <p class="text-gray-300 mb-8 text-lg">${textoFinal}</p>
            <div class="${cardStyle} mb-8">
                <h3 class="text-xl font-bold text-white mb-6">Seu Resumo da Sessão</h3>
                <div class="grid grid-cols-3 gap-4 text-white">
                    <div>
                        <p class="text-sm font-medium text-gray-400 uppercase">ACERTOS</p>
                        <p class="text-3xl font-bold text-green-400">${report.acertos}</p>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-400 uppercase">ERROS</p>
                        <p class="text-3xl font-bold text-red-400">${report.erros}</p>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-400 uppercase">ACERTO</p>
                        <p class="text-3xl font-bold text-blue-400">${taxaAcerto}%</p>
                    </div>
                </div>
                <p class="text-gray-400 text-sm mt-4">Total de ${report.total} questões respondidas.</p>
            </div>
            <button data-action="sair-quiz" class="bg-blue-600 text-white font-semibold py-3 px-8 rounded hover:bg-blue-700 transition text-lg">
                ${textoBotao}
            </button>
        </div>
    `;
}
