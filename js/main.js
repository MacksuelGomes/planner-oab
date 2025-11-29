/*
 * ========================================================
 * ARQUIVO: js/main.js (CORRIGIDO PARA NOMES MISTOS NO JSON)
 * ========================================================
 */

import { auth, db } from './auth.js'; 
import { 
    doc, getDoc, collection, getDocs, query, where, updateDoc,
    setDoc, increment, limit, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("🚀 main.js: Carregado.");

// --- [ CONFIGURAÇÃO DE MAPEAMENTO (CORREÇÃO DO JSON) ] ---
// O seu banco tem nomes misturados (ex: "Direito Penal" e "Penal").
// Esta lista garante que o sistema encontre ambos.
const MATERIA_VARIACOES = {
    "etica": ["Ética Profissional", "Etica", "Ética"],
    "constitucional": ["Direito Constitucional", "Constitucional"],
    "civil": ["Direito Civil", "Civil"],
    "processo_civil": ["Direito Processual Civil", "Processo Civil"],
    "penal": ["Direito Penal", "Penal"],
    "processo_penal": ["Direito Processual Penal", "Processo Penal"],
    "administrativo": ["Direito Administrativo", "Administrativo"],
    "tributario": ["Direito Tributário", "Tributario", "Tributário"],
    "trabalho": ["Direito do Trabalho", "Trabalho"],
    "processo_trabalho": ["Processo do Trabalho", "Processo Trabalho", "Direito Processual do Trabalho"],
    "empresarial": ["Direito Empresarial", "Empresarial"],
    "humanos": ["Direitos Humanos", "Humanos"],
    "consumidor": ["Direito do Consumidor", "Consumidor"],
    "ambiental": ["Direito Ambiental", "Ambiental"],
    "eca": ["ECA", "Estatuto da Criança e do Adolescente"],
    "internacional": ["Direito Internacional", "Internacional"],
    "filosofia": ["Filosofia do Direito", "Filosofia"]
};

// --- [ CONSTANTES ] ---
const CICLO_DE_ESTUDOS = [
    "etica", "constitucional", "civil", "processo_civil", "penal", 
    "processo_penal", "administrativo", "tributario", "trabalho", 
    "processo_trabalho", "empresarial", "etica", "constitucional"
];

const TODAS_MATERIAS = Object.keys(MATERIA_VARIACOES);

// --- [ ESTADO DA APLICAÇÃO ] ---
let appContent = null;
let quizQuestoes = [];
let quizIndexAtual = 0;
let alternativaSelecionada = null;
let respostaConfirmada = false;
let metaQuestoesDoDia = 20;
let quizReturnPath = 'menu';
let quizTitle = 'Estudo';
let quizReport = { acertos: 0, erros: 0, total: 0 };
let quizTempoRestante = null;
let cronometroInterval = null;

// --- [ INICIALIZAÇÃO ] ---
window.initApp = async function(uid) {
    console.log("🚀 initApp chamado para UID:", uid);
    
    // Garante referência ao container principal
    appContent = document.getElementById('dynamic-content');
    if (!appContent) {
        // Tenta criar se não existir
        const main = document.querySelector('main');
        if(main) {
            main.innerHTML = '<div id="dynamic-content"></div>';
            appContent = main.querySelector('#dynamic-content');
        } else {
            return console.error("Erro crítico: <main> não encontrado.");
        }
    }
    
    setupNavigation(); 
    await loadDashboard({ uid: uid });
};

// --- [ DASHBOARD ] ---
export async function loadDashboard(user) {
    if (cronometroInterval) clearInterval(cronometroInterval);
    appContent.innerHTML = renderLoadingState();

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const stats = await calcularEstatisticasEstudo(user.uid);
            appContent.innerHTML = renderStudentDashboard(userData, stats);
            
            // Renderiza gráfico se houver dados
            if (stats.chartLabels.length > 0) {
                setTimeout(() => renderPerformanceChart(stats.chartLabels, stats.chartData), 100);
            }
        } else {
            appContent.innerHTML = `<div class="p-8 text-center">Perfil não encontrado. Recarregue a página.</div>`;
        }
    } catch (error) {
        console.error(error);
        appContent.innerHTML = `<div class="p-8 text-red-500 text-center">Erro: ${error.message}</div>`;
    }
}

async function calcularEstatisticasEstudo(uid) {
    const progressoRef = collection(db, 'users', uid, 'progresso');
    const snapshot = await getDocs(progressoRef);
    let totalResolvidas = 0, totalAcertos = 0;
    let chartLabels = [], chartData = [];

    snapshot.forEach(doc => {
        const d = doc.data();
        totalResolvidas += d.totalResolvidas || 0;
        totalAcertos += d.totalAcertos || 0;
        if(d.totalResolvidas > 0) {
            chartLabels.push(doc.id);
            chartData.push(((d.totalAcertos/d.totalResolvidas)*100).toFixed(0));
        }
    });

    const taxaGlobal = totalResolvidas > 0 ? ((totalAcertos / totalResolvidas) * 100).toFixed(0) : 0;
    return { totalResolvidas, totalAcertos, taxaGlobal, chartLabels, chartData };
}

// --- [ CONTROLADOR DE EVENTOS ] ---
document.addEventListener('click', async (e) => {
    // 1. Lógica de Seleção de Alternativa (Visual)
    const alternativaEl = e.target.closest('[data-alternativa]');
    if (alternativaEl && !respostaConfirmada) {
        // Remove seleção anterior
        document.querySelectorAll('[data-alternativa]').forEach(el => {
            el.classList.remove('bg-blue-50', 'border-blue-500', 'text-blue-800');
            el.classList.add('bg-white', 'border-gray-200', 'text-gray-700');
        });
        // Aplica nova seleção
        alternativaEl.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
        alternativaEl.classList.add('bg-blue-50', 'border-blue-500', 'text-blue-800');
        alternativaSelecionada = alternativaEl.dataset.alternativa;
    }

    // 2. Botões de Ação
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    
    try {
        if (action === 'show-free-study') {
            quizReturnPath = 'menu';
            appContent.innerHTML = renderFreeStudyMenu();
        }
        else if (action === 'start-study-session') {
            await handleStartStudySession(btn.dataset.materia);
        }
        else if (action === 'confirmar-resposta') {
            await handleConfirmarResposta();
        }
        else if (action === 'proxima-questao') {
            await handleProximaQuestao();
        }
        else if (action === 'sair-quiz' || action === 'student-voltar-menu') {
            loadDashboard(auth.currentUser);
        }
        else if (action === 'show-simulados-menu') {
            alert("Simulados em breve (Ajuste de banco em andamento)");
        }
    } catch (err) {
        console.error("Erro na ação:", err);
        alert("Erro: " + err.message);
    }
});

// --- [ LÓGICA DO QUIZ ] ---

async function handleStartStudySession(materiaKey) {
    appContent.innerHTML = renderLoadingState();
    
    // Pega as variações de nome (Ex: "Direito Penal" e "Penal")
    const variacoes = MATERIA_VARIACOES[materiaKey] || [materiaKey];
    console.log(`🔍 Buscando questões para: ${variacoes.join(' OU ')}`);

    try {
        // Usa o operador 'in' para buscar qualquer uma das variações
        const q = query(
            collection(db, 'questoes_oab'), 
            where("materia", "in", variacoes), 
            limit(50)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            appContent.innerHTML = `
                <div class="text-center p-10">
                    <p class="text-gray-600 mb-4">Nenhuma questão encontrada para <b>${materiaKey}</b>.</p>
                    <p class="text-sm text-gray-400">Verifique se o banco de dados foi carregado corretamente.</p>
                    <button data-action="student-voltar-menu" class="mt-4 text-blue-600 font-bold">Voltar</button>
                </div>`;
            return;
        }

        const questoes = [];
        snapshot.forEach(doc => {
            questoes.push({ ...doc.data(), id: doc.id });
        });

        // Embaralha as questões
        questoes.sort(() => Math.random() - 0.5);

        iniciarQuiz(questoes, `Estudo: ${materiaKey.toUpperCase()}`);

    } catch (error) {
        console.error(error);
        appContent.innerHTML = `<p class="text-red-500 text-center mt-10">Erro: ${error.message}</p>`;
    }
}

function iniciarQuiz(questoes, titulo) {
    quizQuestoes = questoes;
    quizIndexAtual = 0;
    alternativaSelecionada = null;
    respostaConfirmada = false;
    quizTitle = titulo;
    quizReport = { acertos: 0, erros: 0, total: 0 };
    
    renderQuizUI();
}

function renderQuizUI() {
    const questao = quizQuestoes[quizIndexAtual];
    if (!questao) return renderRelatorioFinal();

    // Normaliza as chaves das alternativas (às vezes vem 'a', às vezes 'A')
    const alts = questao.alternativas;
    
    const htmlAlts = ['a', 'b', 'c', 'd'].map(letra => {
        const texto = alts[letra] || alts[letra.toUpperCase()];
        if (!texto) return '';
        return `
            <div data-alternativa="${letra}" class="p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 mb-3">
                <span class="font-bold text-gray-400 w-6 uppercase">${letra})</span>
                <span class="flex-1">${texto}</span>
            </div>
        `;
    }).join('');

    appContent.innerHTML = `
        <div class="max-w-3xl mx-auto pb-20">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">${quizTitle}</h2>
                    <p class="text-sm text-gray-500">Questão ${quizIndexAtual + 1} de ${quizQuestoes.length}</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div class="mb-6">
                    <span class="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">
                        ${questao.materia} | ${questao.tema || 'Geral'}
                    </span>
                    <p class="text-lg font-medium text-gray-900 leading-relaxed">${questao.enunciado}</p>
                </div>
                <div class="space-y-3">
                    ${htmlAlts}
                </div>
            </div>

            <div id="quiz-feedback-area" class="hidden mb-20">
                </div>

            <div class="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-between items-center z-10 md:static md:bg-transparent md:border-0">
                <button data-action="sair-quiz" class="text-gray-500 font-medium hover:text-red-600">Sair</button>
                <button id="btn-quiz-action" data-action="confirmar-resposta" 
                        class="bg-gray-900 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-black transition transform active:scale-95">
                    Confirmar Resposta
                </button>
            </div>
        </div>
    `;
}

async function handleConfirmarResposta() {
    if (!alternativaSelecionada) return alert("Selecione uma alternativa!");
    if (respostaConfirmada) return;

    respostaConfirmada = true;
    const questao = quizQuestoes[quizIndexAtual];
    const correta = questao.correta.toLowerCase();
    const selecionada = alternativaSelecionada.toLowerCase();
    const acertou = correta === selecionada;

    // Atualiza Stats Local
    quizReport.total++;
    if (acertou) quizReport.acertos++; else quizReport.erros++;

    // Salva no Firebase (Sem travar a UI)
    salvarProgresso(questao, acertou);

    // Feedback Visual
    const feedbackArea = document.getElementById('quiz-feedback-area');
    feedbackArea.classList.remove('hidden');
    feedbackArea.innerHTML = `
        <div class="p-6 rounded-xl border ${acertou ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
            <h3 class="font-bold ${acertou ? 'text-green-800' : 'text-red-800'} mb-2 text-xl">
                ${acertou ? 'Acertou! 🎉' : 'Errou 😔'}
            </h3>
            <p class="text-gray-700 mb-2">A alternativa correta é a <strong>${correta.toUpperCase()}</strong>.</p>
            ${questao.comentario ? `<div class="mt-4 p-4 bg-white/50 rounded text-sm text-gray-800 border border-gray-200"><strong>Comentário:</strong> ${questao.comentario}</div>` : ''}
        </div>
    `;

    // Rola para ver o feedback
    feedbackArea.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Atualiza Botão
    const btn = document.getElementById('btn-quiz-action');
    btn.textContent = "Próxima Questão →";
    btn.dataset.action = "proxima-questao";
    btn.classList.remove('bg-gray-900');
    btn.classList.add('bg-blue-600');
}

async function salvarProgresso(questao, acertou) {
    try {
        const userUid = auth.currentUser.uid;
        // Salva estatística geral
        const progRef = doc(db, 'users', userUid, 'progresso', 'geral');
        await setDoc(progRef, {
            totalResolvidas: increment(1),
            totalAcertos: increment(acertou ? 1 : 0)
        }, { merge: true });

        // Salva no caderno de erros/acertos
        const collectionName = acertou ? 'questoes_acertadas' : 'questoes_erradas';
        const cadernoRef = doc(db, 'users', userUid, collectionName, questao.id);
        await setDoc(cadernoRef, { ...questao, dataResolucao: Timestamp.now() });

        // Se acertou, remove do caderno de erros (se estiver lá)
        if (acertou) {
            await deleteDoc(doc(db, 'users', userUid, 'questoes_erradas', questao.id));
        }
    } catch (e) {
        console.error("Erro ao salvar progresso silencioso:", e);
    }
}

async function handleProximaQuestao() {
    quizIndexAtual++;
    if (quizIndexAtual >= quizQuestoes.length) {
        renderRelatorioFinal();
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuizUI();
        window.scrollTo(0,0);
    }
}

function renderRelatorioFinal() {
    const perc = ((quizReport.acertos / quizReport.total) * 100).toFixed(0);
    appContent.innerHTML = `
        <div class="text-center max-w-md mx-auto pt-10">
            <div class="mb-6 text-6xl">🏁</div>
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Resumo da Sessão</h2>
            <p class="text-gray-500 mb-8">Você finalizou as questões selecionadas.</p>

            <div class="grid grid-cols-3 gap-4 mb-8">
                <div class="bg-green-50 p-4 rounded-xl border border-green-100">
                    <p class="text-xs font-bold text-green-600 uppercase">Acertos</p>
                    <p class="text-3xl font-bold text-green-800">${quizReport.acertos}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-xl border border-red-100">
                    <p class="text-xs font-bold text-red-600 uppercase">Erros</p>
                    <p class="text-3xl font-bold text-red-800">${quizReport.erros}</p>
                </div>
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p class="text-xs font-bold text-blue-600 uppercase">Aproveitamento</p>
                    <p class="text-3xl font-bold text-blue-800">${perc}%</p>
                </div>
            </div>

            <button data-action="student-voltar-menu" class="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition">
                Voltar ao Menu Principal
            </button>
        </div>
    `;
}

// --- [ VIEWS AUXILIARES ] ---
function renderLoadingState() {
    return `<div class="flex items-center justify-center h-64"><div class="spinner"></div></div>`;
}

function renderStudentDashboard(userData, stats) {
    return `
        <div class="max-w-5xl mx-auto">
            <header class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">Olá, ${userData.nome || 'Estudante'}!</h1>
                    <p class="text-gray-500 text-sm">Vamos treinar hoje?</p>
                </div>
            </header>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p class="text-xs font-bold text-gray-400 uppercase">Questões Feitas</p>
                    <p class="text-2xl font-bold text-gray-900">${stats.totalResolvidas}</p>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p class="text-xs font-bold text-gray-400 uppercase">Taxa de Acerto</p>
                    <p class="text-2xl font-bold ${stats.taxaGlobal >= 50 ? 'text-green-600' : 'text-orange-500'}">${stats.taxaGlobal}%</p>
                </div>
            </div>

            <h2 class="text-lg font-bold text-gray-800 mb-4">O que vamos estudar?</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <button data-action="show-free-study" class="bg-blue-600 text-white p-6 rounded-xl shadow-md hover:bg-blue-700 transition text-left flex flex-col justify-between h-32 group">
                    <ion-icon name="library" class="text-3xl mb-2 group-hover:scale-110 transition"></ion-icon>
                    <span class="font-bold text-lg">Estudo por Matéria</span>
                </button>
                <button class="bg-white border border-gray-200 text-gray-600 p-6 rounded-xl hover:border-blue-300 hover:shadow-md transition text-left flex flex-col justify-between h-32 opacity-50 cursor-not-allowed">
                    <ion-icon name="document-text" class="text-3xl mb-2"></ion-icon>
                    <span class="font-bold text-lg">Simulados (Em Breve)</span>
                </button>
                <button class="bg-white border border-gray-200 text-gray-600 p-6 rounded-xl hover:border-blue-300 hover:shadow-md transition text-left flex flex-col justify-between h-32 opacity-50 cursor-not-allowed">
                    <ion-icon name="alert-circle" class="text-3xl mb-2"></ion-icon>
                    <span class="font-bold text-lg">Meus Erros (Em Breve)</span>
                </button>
            </div>
        </div>
    `;
}

function renderFreeStudyMenu() {
    // Gera botões para cada matéria do mapa
    const botoes = Object.keys(MATERIA_VARIACOES).map(key => {
        // Tenta pegar um nome bonito (o primeiro do array)
        const nomeBonito = MATERIA_VARIACOES[key][0];
        return `
            <button data-action="start-study-session" data-materia="${key}" 
                    class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition text-left flex items-center gap-3 group">
                <div class="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition"></div>
                <span class="font-medium text-gray-700 group-hover:text-blue-700">${nomeBonito}</span>
            </button>
        `;
    }).join('');

    return `
        <div class="max-w-4xl mx-auto">
            <button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2">
                <ion-icon name="arrow-back"></ion-icon> Voltar
            </button>
            
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Escolha uma Matéria</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${botoes}
            </div>
        </div>
    `;
}

// Funções de Navegação (Menu Superior)
function setupNavigation() {
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(btn => {
        btn.onclick = (e) => { 
            e.preventDefault();
            const view = btn.dataset.view;
            if(view === 'dashboard') loadDashboard(auth.currentUser);
            else if(view === 'simulados') alert("Em breve");
        };
    });
}
