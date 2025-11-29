/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO FINAL COM RESET FUNCIONANDO)
 * ========================================================
 */

// --- [ PARTE 1: IMPORTAR MÓDULOS ] ---
import { auth, db } from './auth.js'; 
import { 
    doc, getDoc, collection, getDocs, query, where, updateDoc,
    setDoc, increment, limit, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("🚀 main.js: Carregado (Versão Final + Reset).");

// --- [ CONFIGURAÇÃO: MAPA DE VARIAÇÕES ] ---
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

const CICLO_DE_ESTUDOS = [
    "etica", "constitucional", "civil", "processo_civil", "penal", 
    "processo_penal", "administrativo", "tributario", "trabalho", 
    "processo_trabalho", "empresarial", "etica", "constitucional"
];

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
    
    appContent = document.getElementById('dynamic-content');
    if (!appContent) {
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

// --- [ DASHBOARD & ESTATÍSTICAS ] ---
export async function loadDashboard(user) {
    if (cronometroInterval) clearInterval(cronometroInterval);
    appContent.innerHTML = renderLoadingState();

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            await atualizarSequenciaDias(userData, userDocRef);

            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                const stats = await calcularEstatisticasEstudo(user.uid);
                appContent.innerHTML = renderStudentDashboard(userData, stats);
                
                // Renderiza o gráfico se houver dados
                if (stats.chartLabels.length > 0) {
                    setTimeout(() => {
                        if (typeof renderPerformanceChart === 'function') {
                            renderPerformanceChart(stats.chartLabels, stats.chartData);
                        }
                    }, 500);
                }
            }
        } else {
            appContent.innerHTML = `<div class="p-8 text-center">Perfil não encontrado. Recarregue a página.</div>`;
        }
    } catch (error) {
        console.error(error);
        appContent.innerHTML = `<div class="p-8 text-red-500 text-center">Erro: ${error.message}</div>`;
    }
}

async function atualizarSequenciaDias(userData, userDocRef) {
    const hojeStr = new Date().toISOString().split('T')[0];
    let ultimoLoginData = userData.ultimoLogin ? userData.ultimoLogin.toDate() : new Date();
    const ultimoLoginStr = ultimoLoginData.toISOString().split('T')[0];

    if (ultimoLoginStr !== hojeStr) {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = ontem.toISOString().split('T')[0];

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
            const nomeBonito = MATERIA_VARIACOES[doc.id] ? MATERIA_VARIACOES[doc.id][0] : doc.id;
            chartLabels.push(nomeBonito);
            chartData.push(((d.totalAcertos/d.totalResolvidas)*100).toFixed(0));
        }
    });

    const taxaGlobal = totalResolvidas > 0 ? ((totalAcertos / totalResolvidas) * 100).toFixed(0) : 0;
    return { totalResolvidas, totalAcertos, taxaGlobal, chartLabels, chartData };
}

// --- [ GRÁFICO (Chart.js) ] ---
function renderPerformanceChart(labels, data) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;

    if (window.myChart instanceof Chart) {
        window.myChart.destroy();
    }

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Taxa de Acerto (%)',
                data: data,
                backgroundColor: 'rgba(37, 99, 235, 0.6)', 
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- [ CONTROLADOR DE EVENTOS ] ---
document.addEventListener('click', async (e) => {
    // 1. Seleção Visual
    const alternativaEl = e.target.closest('[data-alternativa]');
    if (alternativaEl && !respostaConfirmada) {
        document.querySelectorAll('[data-alternativa]').forEach(el => {
            el.classList.remove('bg-blue-50', 'border-blue-500', 'text-blue-800');
            el.classList.add('bg-white', 'border-gray-200', 'text-gray-700');
        });
        alternativaEl.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
        alternativaEl.classList.add('bg-blue-50', 'border-blue-500', 'text-blue-800');
        alternativaSelecionada = alternativaEl.dataset.alternativa;
    }

    // 2. Ações
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    
    try {
        switch(action) {
            case 'show-free-study': 
                quizReturnPath = 'menu';
                appContent.innerHTML = renderFreeStudyMenu(); 
                break;
            case 'start-study-session': 
                await handleStartStudySession(btn.dataset.materia); 
                break;
            
            case 'show-guided-planner': await abrirPlannerGuiado(); break;
            case 'show-simulados-menu': 
                quizReturnPath = 'simulados';
                appContent.innerHTML = renderSimuladosMenu(); 
                break;
            case 'start-simulado-edicao-dropdown': await handleStartSimuladoDropdown(); break;
            case 'start-simulado-assertivo': await handleStartSimuladoAssertivo(); break;

            case 'show-caderno-erros': 
                quizReturnPath = 'erros'; 
                await handleStartCaderno('questoes_erradas', 'Caderno de Erros'); 
                break;
            case 'show-caderno-acertos': 
                quizReturnPath = 'acertos'; 
                await handleStartCaderno('questoes_acertadas', 'Caderno de Acertos'); 
                break;
            case 'limpar-caderno-erros': await handleLimparCaderno('questoes_erradas'); break;
            case 'limpar-caderno-acertos': await handleLimparCaderno('questoes_acertadas'); break;

            case 'confirmar-resposta': await handleConfirmarResposta(); break;
            case 'proxima-questao': await handleProximaQuestao(); break;
            case 'sair-quiz': 
            case 'student-voltar-menu':
                loadDashboard(auth.currentUser); 
                break;
            
            case 'show-create-question-form': appContent.innerHTML = renderCreateQuestionForm(); break;
            case 'admin-voltar-painel': loadDashboard(auth.currentUser); break;
            case 'resetar-desempenho': await handleResetarDesempenho(); break;
        }
    } catch (err) {
        console.error("Erro na ação:", err);
        alert("Erro: " + err.message);
    }
});

document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-planner-setup') {
        e.preventDefault();
        await handleSavePlannerSetup(e.target);
    }
});

// --- [ LÓGICA: PLANNER E CICLO ] ---
async function abrirPlannerGuiado() {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    if (userData.metaDiaria) {
        let idx = userData.cicloIndex || 0;
        if (idx >= CICLO_DE_ESTUDOS.length) idx = 0;
        appContent.innerHTML = renderPlanner_TarefaDoDia(userData, idx);
    } else {
        appContent.innerHTML = renderPlannerSetupForm();
    }
}

async function handleSavePlannerSetup(form) {
    const meta = form.metaDiaria.value;
    try { 
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
            metaDiaria: parseInt(meta), 
            cicloIndex: 0 
        }); 
        abrirPlannerGuiado(); 
    } catch(e) { console.error(e); }
}

// --- [ LÓGICA: QUIZ E BUSCA ] ---
async function handleStartStudySession(materiaKey) {
    appContent.innerHTML = renderLoadingState();
    
    const variacoes = MATERIA_VARIACOES[materiaKey] || [materiaKey];
    console.log(`🔍 Buscando questões para: ${variacoes.join(' OU ')}`);

    try {
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
                    <button data-action="student-voltar-menu" class="mt-4 text-blue-600 font-bold">Voltar</button>
                </div>`;
            return;
        }

        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        questoes.sort(() => Math.random() - 0.5); 

        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        metaQuestoesDoDia = userDoc.data()?.metaDiaria || 20;

        const nomeMateria = MATERIA_VARIACOES[materiaKey] ? MATERIA_VARIACOES[materiaKey][0] : materiaKey;
        iniciarQuiz(questoes, `Estudo: ${nomeMateria}`);

    } catch (error) {
        console.error(error);
        appContent.innerHTML = `<p class="text-red-500 text-center mt-10">Erro: ${error.message}</p>`;
    }
}

async function handleStartSimuladoDropdown() {
    const select = document.getElementById('select-simulado-edicao');
    if (!select || !select.value) return alert("Selecione uma edição.");
    
    const [num, rom] = select.value.split(',');
    appContent.innerHTML = renderLoadingState();
    
    const variacoes = [`Exame ${rom}`, `OAB ${rom}`, num, rom, `Exame ${num}`, rom.trim()];
    
    try {
        const q = query(collection(db, 'questoes_oab'), where("edicao", "in", variacoes));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return alert(`Nenhuma questão encontrada para o exame ${rom}.`);
        }
        
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        iniciarQuiz(questoes, `Simulado ${rom}`, 5 * 60 * 60); 
    } catch (error) {
        alert("Erro ao carregar simulado: " + error.message);
        loadDashboard(auth.currentUser);
    }
}

async function handleStartSimuladoAssertivo() {
    appContent.innerHTML = renderLoadingState();
    try {
        const q = query(collection(db, 'questoes_oab'), limit(200)); 
        const snapshot = await getDocs(q);
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        questoes.sort(() => Math.random() - 0.5);
        iniciarQuiz(questoes.slice(0, 80), "Simulado Assertivo", 5 * 60 * 60);
    } catch (error) { console.error(error); }
}

async function handleStartCaderno(colecaoNome, titulo) {
    appContent.innerHTML = renderLoadingState();
    try {
        const ref = collection(db, 'users', auth.currentUser.uid, colecaoNome);
        const snapshot = await getDocs(ref);
        if (snapshot.empty) {
            appContent.innerHTML = `<div class="text-center p-10"><p>${titulo} está vazio.</p><button data-action="student-voltar-menu" class="text-blue-600">Voltar</button></div>`;
            return;
        }
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        iniciarQuiz(questoes, titulo);
    } catch (error) { alert("Erro: " + error.message); }
}

async function handleLimparCaderno(colecaoNome) {
    if (!confirm("Tem certeza que deseja apagar todas as questões deste caderno?")) return;
    try {
        const ref = collection(db, 'users', auth.currentUser.uid, colecaoNome);
        const snapshot = await getDocs(ref);
        const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(promises);
        alert("Caderno limpo!");
        loadDashboard(auth.currentUser);
    } catch(e) { console.error(e); }
}

// --- [ FUNÇÃO DE RESETAR O PROGRESSO GERAL ] ---
async function handleResetarDesempenho() {
    if(!confirm("⚠️ ATENÇÃO: Isso apagará TODO o seu histórico de questões, gráficos e cadernos.\n\nEssa ação não pode ser desfeita. Deseja continuar?")) return;
    
    appContent.innerHTML = renderLoadingState();

    try {
        const uid = auth.currentUser.uid;
        
        // 1. Função auxiliar para deletar subcoleção inteira
        const deleteSubcollection = async (subName) => {
            const ref = collection(db, 'users', uid, subName);
            const snapshot = await getDocs(ref);
            const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(promises);
        };

        // 2. Apaga as 3 subcoleções principais
        await deleteSubcollection('progresso');
        await deleteSubcollection('questoes_erradas');
        await deleteSubcollection('questoes_acertadas');

        // 3. Zera contadores no documento principal do usuário (opcional, mantemos dias de estudo)
        // Se quiser zerar também os dias de estudo, descomente abaixo:
        /*
        await updateDoc(doc(db, 'users', uid), {
            totalDiasEstudo: 0,
            sequenciaDias: 0
        });
        */

        alert("Progresso resetado com sucesso! Vamos começar do zero. 🚀");
        loadDashboard(auth.currentUser);

    } catch (error) {
        console.error("Erro no reset:", error);
        alert("Erro ao resetar: " + error.message);
        loadDashboard(auth.currentUser);
    }
}

// --- [ EXECUÇÃO DO QUIZ ] ---

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

function startCronometro() {
    cronometroInterval = setInterval(() => {
        quizTempoRestante--;
        const timerEl = document.getElementById('quiz-timer-display');
        if(timerEl) {
            const h = Math.floor(quizTempoRestante / 3600).toString().padStart(2,'0');
            const m = Math.floor((quizTempoRestante % 3600) / 60).toString().padStart(2,'0');
            const s = (quizTempoRestante % 60).toString().padStart(2,'0');
            timerEl.textContent = `${h}:${m}:${s}`;
        }
        if (quizTempoRestante <= 0) {
            clearInterval(cronometroInterval);
            alert("Tempo esgotado!");
            renderRelatorioFinal();
        }
    }, 1000);
}

function renderQuizUI() {
    const questao = quizQuestoes[quizIndexAtual];
    if (!questao) return renderRelatorioFinal();

    const meta = (quizReturnPath === 'menu') ? Math.min(metaQuestoesDoDia, quizQuestoes.length) : quizQuestoes.length;
    let timerHtml = quizTempoRestante ? `<div id="quiz-timer-display" class="font-mono bg-gray-900 text-white px-3 py-1 rounded text-sm">Carregando...</div>` : '';

    const htmlAlts = ['a', 'b', 'c', 'd'].map(letra => {
        const texto = questao.alternativas[letra] || questao.alternativas[letra.toUpperCase()];
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
                    <p class="text-sm text-gray-500">Questão ${quizIndexAtual + 1}</p>
                </div>
                ${timerHtml}
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div class="mb-6">
                    <span class="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">
                        ${questao.materia}
                    </span>
                    <p class="text-lg font-medium text-gray-900 leading-relaxed mt-2">${questao.enunciado}</p>
                </div>
                <div class="space-y-3">${htmlAlts}</div>
            </div>
            <div id="quiz-feedback-area" class="hidden mb-20"></div>
            <div class="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-between items-center z-10 md:static md:bg-transparent md:border-0">
                <button data-action="sair-quiz" class="text-gray-500 font-medium hover:text-red-600">Sair</button>
                <button id="btn-quiz-action" data-action="confirmar-resposta" class="bg-gray-900 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-black transition transform active:scale-95">Confirmar Resposta</button>
            </div>
        </div>
    `;
}

async function handleConfirmarResposta() {
    if (!alternativaSelecionada) return alert("Selecione uma alternativa!");
    if (respostaConfirmada) return;

    respostaConfirmada = true;
    const questao = quizQuestoes[quizIndexAtual];
    const correta = String(questao.correta).toLowerCase().trim();
    const selecionada = String(alternativaSelecionada).toLowerCase().trim();
    const acertou = correta === selecionada;

    quizReport.total++;
    if (acertou) quizReport.acertos++; else quizReport.erros++;

    try {
        const userUid = auth.currentUser.uid;
        let materiaKey = "geral";
        for (const [key, values] of Object.entries(MATERIA_VARIACOES)) {
            if (values.includes(questao.materia)) { materiaKey = key; break; }
        }

        const progRef = doc(db, 'users', userUid, 'progresso', materiaKey);
        await setDoc(progRef, {
            totalResolvidas: increment(1),
            totalAcertos: increment(acertou ? 1 : 0)
        }, { merge: true });

        const collectionName = acertou ? 'questoes_acertadas' : 'questoes_erradas';
        const cadernoRef = doc(db, 'users', userUid, collectionName, String(questao.id));
        await setDoc(cadernoRef, { ...questao, dataResolucao: Timestamp.now() });

        if (acertou) {
            await deleteDoc(doc(db, 'users', userUid, 'questoes_erradas', String(questao.id)));
        }
    } catch (e) { console.error("Erro ao salvar:", e); }

    const feedbackArea = document.getElementById('quiz-feedback-area');
    feedbackArea.classList.remove('hidden');
    feedbackArea.innerHTML = `
        <div class="p-6 rounded-xl border ${acertou ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
            <h3 class="font-bold ${acertou ? 'text-green-800' : 'text-red-800'} mb-2 text-xl">${acertou ? 'Acertou! 🎉' : 'Errou 😔'}</h3>
            <p class="text-gray-700 mb-2">A alternativa correta é a <strong>${correta.toUpperCase()}</strong>.</p>
            ${questao.comentario ? `<div class="mt-4 p-4 bg-white/50 rounded text-sm text-gray-800 border border-gray-200"><strong>Comentário:</strong> ${questao.comentario}</div>` : ''}
        </div>
    `;
    feedbackArea.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const btn = document.getElementById('btn-quiz-action');
    btn.textContent = "Próxima Questão →";
    btn.dataset.action = "proxima-questao";
    btn.classList.replace('bg-gray-900', 'bg-blue-600');
}

async function handleProximaQuestao() {
    quizIndexAtual++;
    const fimPorMeta = (quizReturnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia);
    
    if (quizIndexAtual >= quizQuestoes.length || fimPorMeta) {
        renderRelatorioFinal();
        if (quizReturnPath === 'menu') {
            const user = auth.currentUser;
            const ref = doc(db, 'users', user.uid);
            getDoc(ref).then(snap => {
                const idx = snap.data().cicloIndex || 0;
                updateDoc(ref, { cicloIndex: (idx + 1) % CICLO_DE_ESTUDOS.length });
            });
        }
    } else {
        alternativaSelecionada = null;
        respostaConfirmada = false;
        renderQuizUI();
        window.scrollTo(0,0);
    }
}

function renderRelatorioFinal() {
    const perc = quizReport.total > 0 ? ((quizReport.acertos / quizReport.total) * 100).toFixed(0) : 0;
    appContent.innerHTML = `
        <div class="text-center max-w-md mx-auto pt-10">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Resumo da Sessão</h2>
            <div class="grid grid-cols-3 gap-4 mb-8 mt-8">
                <div class="bg-green-50 p-4 rounded-xl border border-green-100">
                    <p class="text-xs font-bold text-green-600 uppercase">Acertos</p>
                    <p class="text-3xl font-bold text-green-800">${quizReport.acertos}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-xl border border-red-100">
                    <p class="text-xs font-bold text-red-600 uppercase">Erros</p>
                    <p class="text-3xl font-bold text-red-800">${quizReport.erros}</p>
                </div>
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p class="text-xs font-bold text-blue-600 uppercase">Taxa</p>
                    <p class="text-3xl font-bold text-blue-800">${perc}%</p>
                </div>
            </div>
            <button data-action="student-voltar-menu" class="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition">
                Voltar ao Menu Principal
            </button>
        </div>
    `;
}

// --- [ VIEWS ] ---
function renderStudentDashboard(userData, stats) {
    return `
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Olá, <span class="text-blue-600">${userData.nome || 'Aluno'}</span>! 👋</h1>
            <p class="text-gray-500">Sua preparação para a OAB continua.</p>
        </header>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Questões</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">${stats.totalResolvidas}</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Acertos</p>
                <p class="text-2xl font-bold text-blue-600 mt-1">${stats.taxaGlobal}%</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Dias</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">${userData.totalDiasEstudo || 0}</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p class="text-xs text-gray-500 uppercase font-bold">Sequência</p>
                <p class="text-2xl font-bold text-orange-500 mt-1">🔥 ${userData.sequenciaDias || 0}</p>
            </div>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
            <div class="md:col-span-2 space-y-4">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Menu de Estudos</h2>
                <div data-action="show-guided-planner" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex items-center gap-4 group">
                    <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition"><ion-icon name="calendar"></ion-icon></div>
                    <div><h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">Planner Guiado</h3><p class="text-sm text-gray-500">Ciclo automático de matérias.</p></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div data-action="show-caderno-erros" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-red-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-red-500 text-2xl mb-2"><ion-icon name="alert-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Caderno de Erros</h3>
                    </div>
                    <div data-action="show-caderno-acertos" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-green-500 text-2xl mb-2"><ion-icon name="checkmark-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Caderno de Acertos</h3>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div data-action="show-simulados-menu" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition cursor-pointer">
                        <div class="text-purple-500 text-2xl mb-2"><ion-icon name="document-text"></ion-icon></div><h3 class="font-bold text-gray-900">Simulados</h3>
                    </div>
                    <div data-action="show-free-study" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 hover:shadow-md transition cursor-pointer">
                        <div class="text-gray-500 text-2xl mb-2"><ion-icon name="library"></ion-icon></div><h3 class="font-bold text-gray-900">Estudo Livre</h3>
                    </div>
                </div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Desempenho</h3>
                <div class="relative h-64 w-full"><canvas id="performanceChart"></canvas></div>
                <div class="mt-6 pt-4 border-t border-gray-100 text-center">
                    <button data-action="resetar-desempenho" class="text-xs text-red-400 hover:text-red-600 font-medium">Resetar progresso</button>
                </div>
            </div>
        </div>
    `;
}

function renderFreeStudyMenu() {
    const botoes = Object.keys(MATERIA_VARIACOES).map(key => {
        const nomeBonito = MATERIA_VARIACOES[key][0];
        return `<button data-action="start-study-session" data-materia="${key}" class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition text-left flex items-center gap-3 group"><div class="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition"></div><span class="font-medium text-gray-700 group-hover:text-blue-700">${nomeBonito}</span></button>`;
    }).join('');
    return `<div class="max-w-4xl mx-auto"><button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><h2 class="text-2xl font-bold text-gray-900 mb-6">Escolha uma Matéria</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${botoes}</div></div>`;
}

function renderSimuladosMenu() {
    const edicoes = [{ num: "38", rom: "XXXVIII" }, { num: "37", rom: "XXXVII" }, { num: "36", rom: "XXXVI" }, { num: "35", rom: "XXXV" }, { num: "34", rom: "XXXIV" }, { num: "33", rom: "XXXIII" }];
    return `<button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-lg mx-auto mt-8"><h2 class="text-2xl font-bold text-gray-800 mb-6">Simulados</h2><label class="block text-sm font-medium text-gray-700 mb-2">Por Edição</label><select id="select-simulado-edicao" class="w-full p-3 border border-gray-300 rounded-lg mb-4"><option value="">Selecione...</option>${edicoes.map(e => `<option value="${e.num},${e.rom}">Exame ${e.rom}</option>`).join('')}</select><button data-action="start-simulado-edicao-dropdown" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mb-6">Iniciar Edição</button><hr class="mb-6"><button data-action="start-simulado-assertivo" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">Simulado Aleatório (80 Questões)</button></div>`;
}

function renderPlanner_TarefaDoDia(userData, cicloIndex) {
    const materiaKey = CICLO_DE_ESTUDOS[cicloIndex] || CICLO_DE_ESTUDOS[0];
    const nomeMateria = MATERIA_VARIACOES[materiaKey] ? MATERIA_VARIACOES[materiaKey][0] : materiaKey;
    return `<button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><div class="bg-white p-8 rounded-2xl border-l-8 border-blue-500 shadow-lg max-w-2xl mx-auto mt-10"><h2 class="text-3xl font-bold text-gray-900 mb-2">Meta de Hoje</h2><div class="flex items-center gap-4 mb-8 mt-6"><div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl"><ion-icon name="target"></ion-icon></div><div><p class="text-sm text-gray-500 uppercase font-bold">Matéria do Ciclo</p><p class="text-2xl font-bold text-blue-600 capitalize">${nomeMateria}</p></div></div><button data-action="start-study-session" data-materia="${materiaKey}" class="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700 transition shadow-lg">Iniciar ${userData.metaDiaria} Questões</button></div>`;
}

function renderPlannerSetupForm() {
    return `<div class="bg-white p-8 rounded-lg shadow-xl border border-gray-200 max-w-lg mx-auto mt-10"><h2 class="text-2xl font-bold text-gray-900 mb-4">Configurar Planner</h2><p class="text-gray-600 mb-6">Quantas questões você quer fazer por dia?</p><form id="form-planner-setup" class="space-y-4"><input type="number" id="metaDiaria" min="5" value="20" required class="w-full px-4 py-2 border rounded-lg"><button type="submit" class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar e Iniciar</button></form></div>`;
}

function renderAdminDashboard(userData) {
    return `<div class="p-8 text-center"><h1 class="text-2xl font-bold">Painel Admin</h1><p>Bem-vindo, ${userData.nome}.</p><button data-action="show-create-question-form" class="mt-4 bg-green-600 text-white px-4 py-2 rounded">Criar Questão</button><button data-action="student-voltar-menu" class="mt-4 bg-gray-500 text-white px-4 py-2 rounded">Sair</button></div>`;
}

function renderCreateQuestionForm() {
    return `<div class="p-8"><h2 class="text-xl">Adicionar Questão (Em construção)</h2><button data-action="admin-voltar-painel">Voltar</button></div>`;
}

function renderLoadingState() {
    return `<div class="flex items-center justify-center h-full p-20"><div class="spinner"></div></div>`;
}

function setupNavigation() {
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(btn => {
        btn.onclick = (e) => { 
            e.preventDefault();
            buttons.forEach(b => b.classList.remove('active', 'border-blue-600', 'text-blue-600'));
            btn.classList.add('active', 'border-blue-600', 'text-blue-600');
            const viewName = btn.dataset.view;
            if (viewName === 'dashboard') loadDashboard(auth.currentUser);
            else if (viewName === 'ciclo') abrirPlannerGuiado();
            else if (viewName === 'simulados') {
                quizReturnPath = 'simulados'; 
                appContent.innerHTML = renderSimuladosMenu();
            }
        };
    });
}
