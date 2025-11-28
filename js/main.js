/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO FINAL - CORRIGIDA)
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db, appId } from './auth.js'; 
import { 
    doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc,
    setDoc, increment, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- [ PARTE 2: SELETORES DO DOM ] ---
const appContainer = document.getElementById('app-container');
let appContent = null;

// Função auxiliar para garantir que o appContent existe
function ensureAppContent() {
    if (!appContainer) {
        console.error("ERRO CRÍTICO: 'app-container' não encontrado no HTML.");
        return null;
    }
    let contentDiv = appContainer.querySelector('#dynamic-content');
    if (!contentDiv) {
        // Procura o main
        const main = appContainer.querySelector('main');
        if (main) {
            main.innerHTML = '<div id="dynamic-content"></div>';
            contentDiv = main.querySelector('#dynamic-content');
        } else {
             // Se não tiver main, cria um div direto no appContainer (fallback)
             contentDiv = document.createElement('div');
             contentDiv.id = 'dynamic-content';
             contentDiv.className = "flex-1 overflow-y-auto p-4 md:p-8"; // Classes do main
             appContainer.appendChild(contentDiv);
        }
    }
    return contentDiv;
}

// --- [ PARTE 3: CONSTANTES E CONFIGURAÇÃO ] ---
const CICLO_DE_ESTUDOS = [
    "etica", "constitucional", "civil", "processo_civil", "penal", 
    "processo_penal", "administrativo", "tributario", "trabalho", 
    "processo_trabalho", "empresarial", 
    "etica", "constitucional", "civil", "processo_civil", "penal"
];

const TODAS_MATERIAS = [
    "etica", "civil", "processo_civil", "penal", "processo_penal", 
    "constitucional", "administrativo", "tributario", "empresarial", 
    "trabalho", "processo_trabalho", "humanos", "consumidor", "ambiental", "eca", "internacional"
];

// --- [ PARTE 4: ESTADO DA APLICAÇÃO ] ---
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

// --- [ PARTE 5: INICIALIZAÇÃO GLOBAL ] ---
window.initApp = async function(uid) {
    console.log("🚀 main.js: Iniciando App para UID:", uid);
    
    appContent = ensureAppContent();
    if (!appContent) return; // Aborta se não conseguiu criar o container

    setupNavigation(); 
    
    // Tenta carregar o dashboard. Se falhar, mostra erro amigável.
    try {
        await loadDashboard({ uid: uid }); // Passa objeto user simples
    } catch (error) {
        console.error("Erro fatal na inicialização do Dashboard:", error);
        appContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-6">
                <div class="text-red-500 text-6xl mb-4"><ion-icon name="alert-circle"></ion-icon></div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Ops! Algo correu mal.</h2>
                <p class="text-gray-600 mb-6">Não conseguimos carregar os seus dados. Verifique a sua conexão.</p>
                <button onclick="window.location.reload()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                    Tentar Novamente
                </button>
                <p class="text-xs text-gray-400 mt-8">Erro técnico: ${error.message}</p>
            </div>
        `;
    }
};

// --- [ PARTE 6: LÓGICA PRINCIPAL (DASHBOARD) ] ---
export async function loadDashboard(user) {
    if (cronometroInterval) clearInterval(cronometroInterval); 
    quizTempoRestante = null; 
    
    appContent.innerHTML = renderLoadingState();

    try {
        // Caminho: /artifacts/{appId}/users/{userId}
        // Verifique se 'appId' está correto no auth.js
        if (!appId) throw new Error("appId não definido. Verifique auth.js");

        const userDocRef = doc(db, `artifacts/${appId}/users`, user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            let userData = userDoc.data();
            
            // Atualização de Sequência (Streak)
            await atualizarSequenciaDias(userData, userDocRef);
            
            // Verifica se é Admin ou Aluno
            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                // Renderiza Dashboard do Aluno
                const stats = await calcularEstatisticasEstudo(user.uid);
                appContent.innerHTML = renderStudentDashboard(userData, stats);
                
                // Inicializa gráfico (se houver dados)
                if (stats.chartLabels.length > 0) {
                    setTimeout(() => renderPerformanceChart(stats.chartLabels, stats.chartData), 100);
                }
            }
        } else {
            // Se o utilizador existe no Auth mas não no Firestore (erro raro)
            console.warn("Perfil não encontrado no Firestore para UID:", user.uid);
            appContent.innerHTML = `<div class="text-center p-8 text-gray-500">Perfil de utilizador não encontrado. <br> <button onclick="window.location.reload()" class="text-blue-600 underline">Recarregar</button></div>`;
        }
    } catch (error) { 
        // Relança o erro para ser capturado pelo initApp
        throw error;
    }
}

// --- [ AUXILIAR: LÓGICA DE NEGÓCIO ] ---

async function atualizarSequenciaDias(userData, userDocRef) {
    try {
        const hojeStr = getFormattedDate(new Date());
        // Converte Timestamp do Firestore com segurança
        let ultimoLoginData = new Date();
        if (userData.ultimoLogin) {
            if (userData.ultimoLogin.toDate) {
                ultimoLoginData = userData.ultimoLogin.toDate();
            } else if (userData.ultimoLogin instanceof Date) {
                ultimoLoginData = userData.ultimoLogin;
            } else {
                // Tenta converter string ou número
                ultimoLoginData = new Date(userData.ultimoLogin);
            }
        }
        
        const ultimoLoginStr = getFormattedDate(ultimoLoginData);

        if (ultimoLoginStr !== hojeStr) {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const ontemStr = getFormattedDate(ontem);

            const totalDiasEstudo = (userData.totalDiasEstudo || 0) + 1;
            let sequenciaDias = 1; 
            
            if (ultimoLoginStr === ontemStr) {
                sequenciaDias = (userData.sequenciaDias || 0) + 1;
            }
            
            await updateDoc(userDocRef, {
                totalDiasEstudo,
                sequenciaDias,
                ultimoLogin: Timestamp.now()
            });
        }
    } catch (e) {
        console.warn("Erro ao atualizar sequência (não crítico):", e);
    }
}

async function calcularEstatisticasEstudo(uid) {
    try {
        const progressoRef = collection(db, `artifacts/${appId}/users/${uid}/progresso`);
        const snapshot = await getDocs(progressoRef);
        
        let totalResolvidas = 0;
        let totalAcertos = 0;
        let chartLabels = [];
        let chartData = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const materia = doc.id.replace(/_/g, ' '); 
            const resolvidas = data.totalResolvidas || 0;
            const acertos = data.totalAcertos || 0;
            
            totalResolvidas += resolvidas;
            totalAcertos += acertos;
            
            if (resolvidas > 0) {
                const taxa = ((acertos / resolvidas) * 100).toFixed(0);
                chartLabels.push(materia);
                chartData.push(taxa);
            }
        });

        const taxaGlobal = totalResolvidas > 0 ? ((totalAcertos / totalResolvidas) * 100).toFixed(0) : 0;
        
        return { totalResolvidas, totalAcertos, taxaGlobal, chartLabels, chartData };
    } catch (e) {
        console.warn("Erro ao calcular estatísticas (retornando zeros):", e);
        return { totalResolvidas: 0, totalAcertos: 0, taxaGlobal: 0, chartLabels: [], chartData: [] };
    }
}

// --- [ PARTE 7: GESTOR DE EVENTOS (O Controlador) ] ---
// Captura todos os cliques no container principal
// Usamos 'appContainer' como listener global para garantir que pegamos eventos 
// mesmo que o 'appContent' seja recriado.
if (appContainer) {
    appContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        const alternativa = e.target.closest('[data-alternativa]');

        // 1. Seleção de Alternativa no Quiz
        if (alternativa && !respostaConfirmada) {
            if (!btn) { 
                alternativaSelecionada = alternativa.dataset.alternativa;
                // Atualiza UI
                document.querySelectorAll('[data-alternativa]').forEach(el => {
                    el.className = "p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50";
                });
                alternativa.className = "p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-blue-50 border-blue-500 text-blue-800";
                return;
            }
        }

        if (!btn) return;
        const action = btn.dataset.action;
        console.log("Ação clicada:", action); // Debug

        // 2. Roteamento de Ações
        try {
            switch(action) {
                // --- Admin ---
                case 'show-create-question-form': appContent.innerHTML = renderCreateQuestionForm(); break;
                case 'show-list-questions': await renderListQuestionsUI(); break;
                case 'admin-voltar-painel': loadDashboard(auth.currentUser); break;
                case 'delete-question': await handleDeleteQuestion(btn.dataset.id, btn); break;

                // --- Menus de Aluno ---
                case 'show-guided-planner': await abrirPlannerGuiado(); break;
                case 'show-free-study': quizReturnPath = 'free-study'; appContent.innerHTML = renderFreeStudyMenu(); break;
                case 'show-simulados-menu': quizReturnPath = 'simulados'; appContent.innerHTML = renderSimuladosMenu(); break;
                case 'show-caderno-erros': quizReturnPath = 'erros'; await renderCadernoErrosMenu(); break;
                case 'show-caderno-acertos': quizReturnPath = 'acertos'; await renderCadernoAcertosMenu(); break;
                case 'show-anotacoes-menu': appContent.innerHTML = renderAnotacoesMenu(); break;
                case 'student-voltar-menu': loadDashboard(auth.currentUser); break;
                
                // --- Ações Específicas ---
                case 'show-anotacoes-editor': await renderAnotacoesEditor(btn.dataset.materia); break;
                case 'start-study-session': await handleStartStudySession(btn.dataset.materia); break;
                
                // --- Iniciar Quizzes ---
                case 'start-simulado-edicao-dropdown': await handleStartSimuladoDropdown(); break;
                case 'start-simulado-assertivo': await handleStartSimuladoAssertivo(); break; // Adicionado
                case 'start-quiz-erros': await handleStartCaderno('questoes_erradas', 'Caderno de Erros'); break;
                case 'start-quiz-acertos': await handleStartCaderno('questoes_acertadas', 'Caderno de Acertos'); break;
                
                // --- Reset ---
                case 'resetar-desempenho': await handleResetarDesempenho(); break;
                case 'limpar-caderno-erros': await handleLimparCaderno('questoes_erradas'); break; // Adicionado
                case 'limpar-caderno-acertos': await handleLimparCaderno('questoes_acertadas'); break; // Adicionado
                
                // --- Quiz Flow ---
                case 'confirmar-resposta': await handleConfirmarResposta(); break;
                case 'proxima-questao': await handleProximaQuestao(); break;
                case 'sair-quiz': loadDashboard(auth.currentUser); break;
            }
        } catch (err) {
            console.error("Erro ao processar ação:", err);
            alert("Erro na ação: " + err.message);
        }
    });

    // Gestor de Formulários
    appContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'form-create-question') {
            e.preventDefault();
            await handleCreateQuestionSubmit(e.target);
        }
        if (e.target.id === 'form-planner-setup') {
            e.preventDefault();
            await handleSavePlannerSetup(e.target);
        }
        // O log-form é tratado dentro da função de renderização por ser dinâmico, 
        // mas podemos adicionar aqui se necessário.
    });

    // Gestor de Anotações (Auto-save)
    appContainer.addEventListener('input', (e) => {
        if (e.target.id === 'anotacoes-textarea') {
            const statusEl = document.getElementById('anotacoes-status');
            statusEl.textContent = 'A guardar...';
            if (anotacaoDebounceTimer) clearTimeout(anotacaoDebounceTimer);
            anotacaoDebounceTimer = setTimeout(async () => {
                await handleSalvarAnotacao(e.target.dataset.materia, e.target.value);
                statusEl.textContent = 'Guardado!';
            }, 1500);
        }
    });
}


// --- [ PARTE 8: LÓGICA DE QUIZ E SIMULADOS ] ---

async function abrirPlannerGuiado() {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/users`, user.uid));
    const userData = userDoc.data();
    if (userData.metaDiaria) {
        appContent.innerHTML = renderPlanner_TarefaDoDia(userData);
    } else {
        appContent.innerHTML = renderPlannerSetupForm();
    }
}

async function handleStartStudySession(materia) {
    appContent.innerHTML = renderLoadingState();
    try {
        // Coleção correta: questoes_oab
        const q = query(collection(db, 'questoes_oab'), where("materia", "==", materia), limit(50));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            appContent.innerHTML = `<div class="text-center p-10"><p>Nenhuma questão de "${materia}" encontrada.</p>${getVoltarButtonHtml()}</div>`;
            return;
        }

        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        
        // Pega meta do utilizador
        const userDoc = await getDoc(doc(db, `artifacts/${appId}/users`, auth.currentUser.uid));
        metaQuestoesDoDia = userDoc.data()?.metaDiaria || 20;
        
        iniciarQuiz(questoes, `Estudo: ${materia}`);
        
    } catch (error) {
        console.error(error);
        appContent.innerHTML = `<p class="text-red-500 text-center mt-10">Erro ao iniciar: ${error.message}</p>${getVoltarButtonHtml()}`;
    }
}

async function handleStartSimuladoDropdown() {
    const select = document.getElementById('select-simulado-edicao');
    if (!select || !select.value) return alert("Selecione uma edição.");
    
    const [num, rom] = select.value.split(',');
    appContent.innerHTML = renderLoadingState();
    
    const variacoes = [`Exame ${rom}`, `OAB ${rom}`, num, rom, `Exame ${num}`];
    
    try {
        const q = query(collection(db, 'questoes_oab'), where("edicao", "in", variacoes));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            appContent.innerHTML = `<div class="text-center p-10"><p>Simulado não encontrado para edição ${rom}.</p>${getVoltarButtonHtml()}</div>`;
            return;
        }
        
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        
        iniciarQuiz(questoes, `Simulado ${rom}`, 5 * 60 * 60); // 5 horas
        
    } catch (error) {
        appContent.innerHTML = `<p class="text-red-500">Erro: ${error.message}</p>${getVoltarButtonHtml()}`;
    }
}

// Nova função para Simulado Assertivo (Baseado em temas)
async function handleStartSimuladoAssertivo() {
    appContent.innerHTML = renderLoadingState();
    try {
        // Pega uma amostra de questões (limite 100 para não ser pesado)
        // Idealmente, teríamos uma coleção de estatísticas de temas mais cobrados
        const q = query(collection(db, 'questoes_oab'), limit(100));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
             appContent.innerHTML = `<div class="text-center p-10"><p>Banco de questões vazio.</p>${getVoltarButtonHtml()}</div>`;
             return;
        }

        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        
        // Embaralha
        questoes.sort(() => Math.random() - 0.5);
        const questoesSelecionadas = questoes.slice(0, 80); // Pega 80

        iniciarQuiz(questoesSelecionadas, "Simulado Assertivo", 5 * 60 * 60);

    } catch (error) {
        appContent.innerHTML = `<p class="text-red-500">Erro: ${error.message}</p>${getVoltarButtonHtml()}`;
    }
}

async function handleStartCaderno(colecaoNome, titulo) {
    appContent.innerHTML = renderLoadingState();
    try {
        const ref = collection(db, `artifacts/${appId}/users/${auth.currentUser.uid}/${colecaoNome}`);
        const snapshot = await getDocs(ref);
        
        if (snapshot.empty) {
            appContent.innerHTML = `<div class="text-center p-10"><p>${titulo} está vazio.</p>${getVoltarButtonHtml()}</div>`;
            return;
        }
        
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        iniciarQuiz(questoes, titulo);
        
    } catch (error) {
        appContent.innerHTML = `<p class="text-red-500">Erro: ${error.message}</p>${getVoltarButtonHtml()}`;
    }
}

// Nova função genérica para limpar cadernos
async function handleLimparCaderno(colecaoNome) {
    if (!confirm("Tem a certeza? Isto apagará todas as questões deste caderno.")) return;
    appContent.innerHTML = renderLoadingState();
    try {
        const ref = collection(db, `artifacts/${appId}/users/${auth.currentUser.uid}/${colecaoNome}`);
        const snapshot = await getDocs(ref);
        
        const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(promises);
        
        alert("Caderno limpo com sucesso.");
        loadDashboard(auth.currentUser);
    } catch (e) {
        console.error(e);
        alert("Erro ao limpar caderno.");
        loadDashboard(auth.currentUser);
    }
}

function iniciarQuiz(questoes, titulo, tempo = null) {
    quizQuestoes = questoes;
    quizIndexAtual = 0;
    alternativaSelecionada = null;
    respostaConfirmada = false;
    quizTitle = titulo;
    quizReport = { acertos: 0, erros: 0, total: 0 };
    quizTempoRestante = tempo;
    
    renderQuizUI();
    if (tempo) startCronometro();
}

async function handleConfirmarResposta() {
    if (!alternativaSelecionada) return alert("Selecione uma alternativa.");
    if (respostaConfirmada) return;
    
    respostaConfirmada = true;
    const questao = quizQuestoes[quizIndexAtual];
    const correta = questao.correta.toLowerCase();
    const selecionada = alternativaSelecionada.toLowerCase();
    const acertou = selecionada === correta;
    
    // Atualiza Report
    quizReport.total++;
    acertou ? quizReport.acertos++ : quizReport.erros++;
    
    // Salva Progresso no Firebase
    try {
        const userUid = auth.currentUser.uid;
        const materiaId = questao.materia || "geral";
        
        // 1. Estatísticas Gerais
        const progRef = doc(db, `artifacts/${appId}/users/${userUid}/progresso`, materiaId);
        await setDoc(progRef, {
            totalResolvidas: increment(1),
            totalAcertos: acertou ? increment(1) : increment(0)
        }, { merge: true });
        
        // 2. Cadernos (Erros/Acertos)
        const erroRef = doc(db, `artifacts/${appId}/users/${userUid}/questoes_erradas`, questao.id);
        const acertoRef = doc(db, `artifacts/${appId}/users/${userUid}/questoes_acertadas`, questao.id);
        
        if (acertou) {
            await setDoc(acertoRef, questao);
            await deleteDoc(erroRef); // Remove dos erros se acertou agora
        } else {
            await setDoc(erroRef, questao);
            await deleteDoc(acertoRef); // Remove dos acertos se errou agora
        }
    } catch (e) { console.error("Erro ao salvar resposta:", e); }
    
    // Atualiza UI (Feedback Visual)
    document.querySelectorAll('[data-alternativa]').forEach(el => {
        const letra = el.dataset.alternativa.toLowerCase();
        el.className = "p-4 border rounded-lg flex items-start gap-3 transition opacity-60 bg-gray-50 border-gray-200";
        
        if (letra === correta) {
            el.className = "p-4 border rounded-lg flex items-start gap-3 bg-green-100 border-green-500 text-green-900 font-medium";
        } else if (letra === selecionada && !acertou) {
            el.className = "p-4 border rounded-lg flex items-start gap-3 bg-red-100 border-red-500 text-red-900";
        }
    });
    
    // Mostra comentário e botão Próxima
    document.getElementById('quiz-comentario').classList.remove('hidden');
    const btn = document.getElementById('quiz-action-btn');
    btn.textContent = "Próxima Questão";
    btn.dataset.action = "proxima-questao";
    btn.className = "bg-gray-900 text-white px-6 py-2 rounded hover:bg-gray-800 transition";
}

async function handleProximaQuestao() {
    quizIndexAtual++;
    const fimPorMeta = quizReturnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia;
    
    if (quizIndexAtual >= quizQuestoes.length || fimPorMeta) {
        renderRelatorioFinal();
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuizUI();
    }
}

function renderRelatorioFinal() {
    const textoBotao = "Voltar ao Menu";
    const textoFinal = `Você completou ${quizReport.total} questões com ${quizReport.acertos} acertos.`;
    appContent.innerHTML = renderQuizReport(quizReport, textoFinal, textoBotao);
    
    // Se for planner, avança ciclo
    if (quizReturnPath === 'menu') {
        const user = auth.currentUser;
        const ref = doc(db, `artifacts/${appId}/users`, user.uid);
        // Lê o index atual e incrementa
        getDoc(ref).then(snap => {
            const idx = snap.data().cicloIndex || 0;
            const novoIdx = (idx + 1) % CICLO_DE_ESTUDOS.length;
            updateDoc(ref, { cicloIndex: novoIdx });
        });
    }
}

// --- [ PARTE 9: RENDERS (O HTML DO APP) ] ---

function renderStudentDashboard(userData, stats) {
    // Garante que 'stats' tem valores padrão se vier undefined
    const s = stats || { totalResolvidas: 0, taxaGlobal: 0, chartLabels: [], chartData: [] };
    
    return `
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Olá, <span class="text-blue-600">${userData.nome || 'Aluno'}</span>! 👋</h1>
            <p class="text-gray-500">Vamos continuar a sua preparação para a OAB.</p>
        </header>

        <!-- Cards de Estatísticas -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Questões</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">${s.totalResolvidas}</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Acertos</p>
                <p class="text-2xl font-bold text-blue-600 mt-1">${s.taxaGlobal}%</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Dias Estudados</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">${userData.totalDiasEstudo || 0}</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Sequência</p>
                <p class="text-2xl font-bold text-orange-500 mt-1">🔥 ${userData.sequenciaDias || 0}</p>
            </div>
        </div>

        <!-- Menu Principal -->
        <div class="grid md:grid-cols-3 gap-6">
            <div class="md:col-span-2 space-y-4">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Menu de Estudos</h2>
                
                <!-- Planner Guiado -->
                <div data-action="show-guided-planner" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex items-center gap-4 group">
                    <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition">
                        <ion-icon name="calendar"></ion-icon>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">Planner Guiado</h3>
                        <p class="text-sm text-gray-500">Siga o ciclo automático de matérias.</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- Caderno de Erros -->
                    <div data-action="show-caderno-erros" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-red-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-red-500 text-2xl mb-2"><ion-icon name="alert-circle"></ion-icon></div>
                        <h3 class="font-bold text-gray-900">Caderno de Erros</h3>
                        <p class="text-xs text-gray-500">Reveja o que errou.</p>
                    </div>
                    <!-- Caderno de Acertos -->
                    <div data-action="show-caderno-acertos" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-green-500 text-2xl mb-2"><ion-icon name="checkmark-circle"></ion-icon></div>
                        <h3 class="font-bold text-gray-900">Caderno de Acertos</h3>
                        <p class="text-xs text-gray-500">Reforce o conhecimento.</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <!-- Simulados -->
                    <div data-action="show-simulados-menu" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-purple-500 text-2xl mb-2"><ion-icon name="document-text"></ion-icon></div>
                        <h3 class="font-bold text-gray-900">Simulados</h3>
                        <p class="text-xs text-gray-500">Provas completas.</p>
                    </div>
                    <!-- Estudo Livre -->
                    <div data-action="show-free-study" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 hover:shadow-md transition cursor-pointer">
                        <div class="text-gray-500 text-2xl mb-2"><ion-icon name="library"></ion-icon></div>
                        <h3 class="font-bold text-gray-900">Estudo Livre</h3>
                        <p class="text-xs text-gray-500">Escolha a matéria.</p>
                    </div>
                </div>
            </div>

            <!-- Gráfico -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Desempenho por Matéria</h3>
                <div class="relative h-64 w-full">
                    ${s.chartLabels.length > 0 ? '<canvas id="performanceChart"></canvas>' : '<p class="text-center text-gray-400 mt-10 text-sm">Responda questões para ver o gráfico.</p>'}
                </div>
                <div class="mt-6 pt-4 border-t border-gray-100 text-center">
                    <button data-action="resetar-desempenho" class="text-xs text-red-400 hover:text-red-600 font-medium">Resetar todo o progresso</button>
                </div>
            </div>
        </div>
    `;
}

function renderQuizUI() {
    const questao = quizQuestoes[quizIndexAtual];
    const meta = (quizReturnPath === 'menu') ? metaQuestoesDoDia : quizQuestoes.length;
    
    let timerHtml = '';
    if (quizTempoRestante) {
        const h = Math.floor(quizTempoRestante / 3600).toString().padStart(2,'0');
        const m = Math.floor((quizTempoRestante % 3600) / 60).toString().padStart(2,'0');
        const s = (quizTempoRestante % 60).toString().padStart(2,'0');
        timerHtml = `<div class="font-mono bg-gray-900 text-white px-3 py-1 rounded text-sm">${h}:${m}:${s}</div>`;
    }

    // Normaliza alternativas (a,b,c,d)
    let altsHtml = '';
    ['A','B','C','D'].forEach(letra => {
        // Tenta maiuscula e minuscula
        const texto = questao.alternativas[letra] || questao.alternativas[letra.toLowerCase()];
        if (texto) {
            altsHtml += `
                <div data-alternativa="${letra}" class="p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50">
                    <span class="font-bold text-gray-400 w-6">${letra})</span>
                    <span class="flex-1">${texto}</span>
                </div>
            `;
        }
    });

    appContent.innerHTML = `
        <div class="max-w-3xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">${quizTitle}</h2>
                    <p class="text-sm text-gray-500">Questão ${quizIndexAtual + 1} de ${meta}</p>
                </div>
                ${timerHtml}
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div class="mb-6">
                    <span class="inline-block bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">${questao.materia}</span>
                    <p class="text-lg font-medium text-gray-900 leading-relaxed">${questao.enunciado}</p>
                </div>
                <div class="space-y-3">
                    ${altsHtml}
                </div>
            </div>

            <!-- Comentário (Oculto inicialmente) -->
            <div id="quiz-comentario" class="hidden bg-blue-50 border border-blue-100 p-6 rounded-xl mb-6">
                <h3 class="font-bold text-blue-900 mb-2">Gabarito & Comentário</h3>
                <p class="text-blue-800 text-sm leading-relaxed">${questao.comentario || 'Sem comentário disponível.'}</p>
            </div>

            <div class="flex justify-between items-center">
                <button data-action="sair-quiz" class="text-gray-500 hover:text-gray-700 font-medium">Sair</button>
                <button id="quiz-action-btn" data-action="confirmar-resposta" 
                        class="bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition shadow-md">
                    Confirmar
                </button>
            </div>
        </div>
    `;
}

// Renderizadores dos Submenus (Simplificados para caber)
function renderFreeStudyMenu() {
    return `
        ${getVoltarButtonHtml()}
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Estudo Livre</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${TODAS_MATERIAS.map(m => `
                <button data-action="start-study-session" data-materia="${m}" 
                        class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition capitalize text-left">
                    ${m.replace('_', ' ')}
                </button>
            `).join('')}
        </div>
    `;
}

function renderSimuladosMenu() {
    const edicoes = [
        { num: "38", rom: "XXXVIII" }, { num: "37", rom: "XXXVII" },
        { num: "36", rom: "XXXVI" }, { num: "35", rom: "XXXV" },
        { num: "34", rom: "XXXIV" }, { num: "33", rom: "XXXIII" }
    ];
    return `
        ${getVoltarButtonHtml()}
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Simulados</h2>
        <div class="bg-white p-6 rounded-xl border border-gray-200 max-w-lg">
            <label class="block text-sm font-medium text-gray-700 mb-2">Escolha a Edição</label>
            <select id="select-simulado-edicao" class="w-full p-3 border border-gray-300 rounded-lg mb-4">
                <option value="">Selecione...</option>
                ${edicoes.map(e => `<option value="${e.num},${e.rom}">Exame ${e.rom}</option>`).join('')}
            </select>
            <button data-action="start-simulado-edicao-dropdown" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Iniciar</button>
            <hr class="my-6">
            <button data-action="start-simulado-assertivo" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">Simulado Assertivo (Temas Quentes)</button>
        </div>
    `;
}

function renderPlanner_TarefaDoDia(userData) {
    const idx = userData.cicloIndex || 0;
    const mat = CICLO_DE_ESTUDOS[idx];
    return `
        ${getVoltarButtonHtml()}
        <div class="bg-white p-8 rounded-2xl border-l-8 border-blue-500 shadow-lg max-w-2xl mx-auto mt-10">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Sua Meta de Hoje</h2>
            <p class="text-gray-500 text-lg mb-8">Foco total na aprovação.</p>
            
            <div class="flex items-center gap-4 mb-8">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl">
                    <ion-icon name="target"></ion-icon>
                </div>
                <div>
                    <p class="text-sm text-gray-500 uppercase font-bold">Matéria do Ciclo</p>
                    <p class="text-2xl font-bold text-blue-600 capitalize">${mat.replace('_', ' ')}</p>
                </div>
            </div>
            
            <button data-action="start-study-session" data-materia="${mat}" 
                    class="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700 transition shadow-lg transform hover:-translate-y-1">
                Iniciar ${userData.metaDiaria} Questões
            </button>
        </div>
    `;
}

function renderLoadingState() {
    return `<div class="flex h-full items-center justify-center"><div class="spinner"></div></div>`;
}

function getVoltarButtonHtml() {
    return `<button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar ao Menu</button>`;
}
