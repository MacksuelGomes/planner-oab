/*
 * ========================================================
 * ARQUIVO: js/main.js (VERSÃO FINAL 3.0 - COM PAINEL ADMIN)
 * ========================================================
 */

import { auth, db } from './auth.js'; 
import { 
    doc, getDoc, collection, getDocs, query, where, updateDoc,
    setDoc, addDoc, increment, limit, Timestamp, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("🚀 main.js: Carregado (Admin Powered).");

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
let isSimuladoMode = false;

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
            
            // Verifica se é Admin (Segurança no Front)
            if (userData.isAdmin === true) {
                appContent.innerHTML = renderAdminDashboard(userData);
            } else {
                // Fluxo Aluno
                await atualizarSequenciaDias(userData, userDocRef);
                const stats = await calcularEstatisticasEstudo(user.uid);
                const topTemas = await getTopTemasComErro(user.uid);
                
                appContent.innerHTML = renderStudentDashboard(userData, stats, topTemas);
                
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

// ... (Funções Auxiliares de Estatísticas e Dias mantidas iguais) ...
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
        if (ultimoLoginStr === ontemStr) sequenciaDias = (userData.sequenciaDias || 0) + 1;
        
        await updateDoc(userDocRef, { totalDiasEstudo, sequenciaDias, ultimoLogin: Timestamp.now() });
    }
}

async function calcularEstatisticasEstudo(uid) {
    const progressoRef = collection(db, 'users', uid, 'progresso');
    const snapshot = await getDocs(progressoRef);
    let totalResolvidas = 0, totalAcertos = 0, chartLabels = [], chartData = [];

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

async function getTopTemasComErro(uid) {
    try {
        const temasRef = collection(db, 'users', uid, 'progresso_temas');
        const q = query(temasRef, orderBy('erros', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const temas = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.erros > 0) {
                temas.push({ nome: data.nomeOriginal || doc.id.replace(/_/g, ' '), erros: data.erros });
            }
        });
        return temas;
    } catch (e) { return []; }
}

function renderPerformanceChart(labels, data) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    if (window.myChart instanceof Chart) window.myChart.destroy();
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
            scales: { y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
}

// --- [ CONTROLADOR DE EVENTOS ] ---
document.addEventListener('click', async (e) => {
    // Lógica Visual Quiz
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

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    
    try {
        switch(action) {
            // Aluno
            case 'show-free-study': quizReturnPath = 'menu'; appContent.innerHTML = renderFreeStudyMenu(); break;
            case 'start-study-session': 
                const qtd = btn.dataset.quantidade ? parseInt(btn.dataset.quantidade) : 50;
                quizReturnPath = (btn.dataset.source === 'planner') ? 'planner' : 'menu';
                await handleStartStudySession(btn.dataset.materia, qtd); 
                break;
            case 'show-guided-planner': await abrirPlannerGuiado(); break;
            case 'show-simulados-menu': quizReturnPath = 'simulados'; appContent.innerHTML = renderSimuladosMenu(); break;
            case 'start-simulado-edicao-dropdown': await handleStartSimuladoDropdown(); break;
            case 'start-simulado-assertivo': await handleStartSimuladoAssertivo(); break;
            case 'show-caderno-erros': quizReturnPath = 'erros'; await handleStartCaderno('questoes_erradas', 'Caderno de Erros'); break;
            case 'show-caderno-acertos': quizReturnPath = 'acertos'; await handleStartCaderno('questoes_acertadas', 'Caderno de Acertos'); break;
            case 'limpar-caderno-erros': await handleLimparCaderno('questoes_erradas'); break;
            case 'limpar-caderno-acertos': await handleLimparCaderno('questoes_acertadas'); break;
            case 'confirmar-resposta': await handleConfirmarResposta(); break;
            case 'proxima-questao': await handleProximaQuestao(); break;
            case 'sair-quiz': case 'student-voltar-menu': loadDashboard(auth.currentUser); break;
            case 'resetar-desempenho': await handleResetarDesempenho(); break;

            // --- ADMIN ACTIONS ---
            case 'admin-voltar-painel': loadDashboard(auth.currentUser); break;
            case 'show-create-question-form': appContent.innerHTML = renderCreateQuestionForm(); break;
            case 'admin-list-questions': await renderAdminQuestionList(); break;
            case 'admin-delete-question': await handleDeleteQuestion(btn.dataset.id); break;
        }
    } catch (err) {
        console.error("Erro:", err);
        alert("Erro: " + err.message);
    }
});

// Listener para Formulários (Planner e Admin)
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-planner-setup') {
        e.preventDefault();
        await handleSavePlannerSetup(e.target);
    }
    if (e.target.id === 'form-create-question') {
        e.preventDefault();
        await handleCreateQuestionSubmit(e.target);
    }
});

// --- [ ADMINISTRAÇÃO ] ---

function renderAdminDashboard(userData) {
    return `
        <div class="max-w-4xl mx-auto p-6">
            <header class="mb-10 text-center">
                <h1 class="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
                <p class="text-gray-500">Olá, Admin <strong>${userData.nome}</strong>. Gestão total do sistema.</p>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button data-action="show-create-question-form" class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 hover:shadow-lg transition group text-left">
                    <div class="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition">
                        <ion-icon name="add-circle"></ion-icon>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">Nova Questão</h3>
                    <p class="text-sm text-gray-500 mt-2">Cadastre manualmente uma nova questão no banco de dados.</p>
                </button>

                <button data-action="admin-list-questions" class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-lg transition group text-left">
                    <div class="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition">
                        <ion-icon name="list"></ion-icon>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">Gerenciar Banco</h3>
                    <p class="text-sm text-gray-500 mt-2">Veja as últimas questões cadastradas e delete se necessário.</p>
                </button>
            </div>
            
            <div class="mt-10 text-center">
                <button onclick="window.location.reload()" class="text-gray-400 hover:text-gray-600 text-sm">Sair / Logout</button>
            </div>
        </div>
    `;
}

function renderCreateQuestionForm() {
    return `
        <div class="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-200 mt-4">
            <h2 class="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ion-icon name="create"></ion-icon> Cadastrar Questão
            </h2>
            
            <form id="form-create-question" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Matéria</label>
                        <select name="materia" required class="w-full p-2 border rounded">
                            ${Object.values(MATERIA_VARIACOES).map(v => `<option value="${v[0]}">${v[0]}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Edição (Ex: 38)</label>
                        <input type="text" name="edicao" required class="w-full p-2 border rounded" placeholder="XXXVIII">
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Tema</label>
                    <input type="text" name="tema" class="w-full p-2 border rounded" placeholder="Ex: Controle de Constitucionalidade">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Enunciado</label>
                    <textarea name="enunciado" required rows="4" class="w-full p-2 border rounded"></textarea>
                </div>

                <div class="grid grid-cols-1 gap-2">
                    <input type="text" name="alt_a" required placeholder="Alternativa A" class="w-full p-2 border rounded bg-gray-50">
                    <input type="text" name="alt_b" required placeholder="Alternativa B" class="w-full p-2 border rounded bg-gray-50">
                    <input type="text" name="alt_c" required placeholder="Alternativa C" class="w-full p-2 border rounded bg-gray-50">
                    <input type="text" name="alt_d" required placeholder="Alternativa D" class="w-full p-2 border rounded bg-gray-50">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-green-700">Correta</label>
                        <select name="correta" required class="w-full p-2 border border-green-300 rounded bg-green-50">
                            <option value="a">A</option>
                            <option value="b">B</option>
                            <option value="c">C</option>
                            <option value="d">D</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Comentário / Gabarito</label>
                    <textarea name="comentario" rows="3" class="w-full p-2 border rounded" placeholder="Explicação da resposta..."></textarea>
                </div>

                <div class="flex justify-end gap-3 pt-4">
                    <button type="button" data-action="admin-voltar-painel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button type="submit" class="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Salvar Questão</button>
                </div>
            </form>
        </div>
    `;
}

async function handleCreateQuestionSubmit(form) {
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = "Salvando...";
    btn.disabled = true;

    try {
        const novaQuestao = {
            materia: form.materia.value,
            edicao: form.edicao.value, // Pode ser número ou Romano
            tema: form.tema.value,
            enunciado: form.enunciado.value,
            alternativas: {
                a: form.alt_a.value,
                b: form.alt_b.value,
                c: form.alt_c.value,
                d: form.alt_d.value
            },
            correta: form.correta.value,
            comentario: form.comentario.value,
            criadoEm: Timestamp.now()
        };

        // Adiciona à coleção 'questoes_oab'
        await addDoc(collection(db, 'questoes_oab'), novaQuestao);
        
        alert("Questão cadastrada com sucesso!");
        form.reset();
        
        // Volta o botão
        btn.textContent = "Salvar Questão";
        btn.disabled = false;

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar: " + error.message);
        btn.textContent = "Tentar Novamente";
        btn.disabled = false;
    }
}

async function renderAdminQuestionList() {
    appContent.innerHTML = renderLoadingState();
    
    try {
        // Busca as 20 últimas questões criadas (para não pesar)
        const q = query(collection(db, 'questoes_oab'), limit(20));
        const snapshot = await getDocs(q);
        
        let rows = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            rows += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3 text-sm font-bold text-gray-700">${d.materia}</td>
                    <td class="p-3 text-sm text-gray-600 truncate max-w-xs">${d.enunciado.substring(0, 60)}...</td>
                    <td class="p-3 text-sm text-center">
                        <button data-action="admin-delete-question" data-id="${doc.id}" class="text-red-500 hover:text-red-700 p-2" title="Excluir">
                            <ion-icon name="trash"></ion-icon>
                        </button>
                    </td>
                </tr>
            `;
        });

        appContent.innerHTML = `
            <div class="max-w-5xl mx-auto p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">Últimas Questões</h2>
                    <button data-action="admin-voltar-painel" class="text-blue-600">Voltar</button>
                </div>
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-gray-100 text-gray-600 text-xs uppercase">
                            <tr>
                                <th class="p-3">Matéria</th>
                                <th class="p-3">Enunciado</th>
                                <th class="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="3" class="p-4 text-center">Nenhuma questão encontrada.</td></tr>'}</tbody>
                    </table>
                </div>
                <p class="text-xs text-gray-400 mt-4 text-center">Exibindo apenas as últimas 20 para performance.</p>
            </div>
        `;
    } catch (error) {
        alert("Erro ao listar: " + error.message);
    }
}

async function handleDeleteQuestion(id) {
    if (!confirm("Tem certeza que deseja excluir esta questão permanentemente?")) return;
    try {
        await deleteDoc(doc(db, 'questoes_oab', id));
        alert("Questão excluída.");
        renderAdminQuestionList(); // Recarrega a lista
    } catch (e) {
        alert("Erro ao excluir: " + e.message);
    }
}

// --- [ FUNÇÕES DO ALUNO (MANTER) ] ---
// (Estas funções são as mesmas do código anterior, essenciais para o aluno)

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
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { metaDiaria: parseInt(meta), cicloIndex: 0 }); 
        abrirPlannerGuiado(); 
    } catch(e) { console.error(e); }
}

async function handleStartStudySession(materiaKey, limitQtd = 50) {
    appContent.innerHTML = renderLoadingState();
    const variacoes = MATERIA_VARIACOES[materiaKey] || [materiaKey];
    try {
        const q = query(collection(db, 'questoes_oab'), where("materia", "in", variacoes), limit(limitQtd));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { appContent.innerHTML = `<div class="text-center p-10"><p>Sem questões.</p><button data-action="student-voltar-menu">Voltar</button></div>`; return; }
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        questoes.sort(() => Math.random() - 0.5); 
        metaQuestoesDoDia = 50; 
        const nomeMateria = MATERIA_VARIACOES[materiaKey] ? MATERIA_VARIACOES[materiaKey][0] : materiaKey;
        iniciarQuiz(questoes, `Estudo: ${nomeMateria}`, null, false);
    } catch (error) { appContent.innerHTML = `<p class="text-red-500 text-center mt-10">Erro: ${error.message}</p>`; }
}

async function handleStartSimuladoDropdown() {
    const select = document.getElementById('select-simulado-edicao');
    const isModoReal = document.getElementById('chk-modo-real')?.checked || false;
    if (!select || !select.value) return alert("Selecione uma edição.");
    const [num, rom] = select.value.split(',');
    appContent.innerHTML = renderLoadingState();
    const variacoes = [`Exame ${rom}`, `OAB ${rom}`, num, rom, `Exame ${num}`, rom.trim()];
    try {
        const q = query(collection(db, 'questoes_oab'), where("edicao", "in", variacoes));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return alert(`Nenhuma questão encontrada.`);
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        iniciarQuiz(questoes, `Simulado ${rom}`, 5 * 60 * 60, isModoReal); 
    } catch (error) { alert("Erro: " + error.message); loadDashboard(auth.currentUser); }
}

async function handleStartSimuladoAssertivo() {
    const isModoReal = document.getElementById('chk-modo-real')?.checked || false;
    appContent.innerHTML = renderLoadingState();
    try {
        const q = query(collection(db, 'questoes_oab'), limit(200)); 
        const snapshot = await getDocs(q);
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        questoes.sort(() => Math.random() - 0.5);
        iniciarQuiz(questoes.slice(0, 80), "Simulado Assertivo", 5 * 60 * 60, isModoReal);
    } catch (error) { console.error(error); }
}

async function handleStartCaderno(colecaoNome, titulo) {
    appContent.innerHTML = renderLoadingState();
    try {
        const ref = collection(db, 'users', auth.currentUser.uid, colecaoNome);
        const snapshot = await getDocs(ref);
        if (snapshot.empty) { appContent.innerHTML = `<div class="text-center p-10"><p>${titulo} vazio.</p><button data-action="student-voltar-menu" class="text-blue-600">Voltar</button></div>`; return; }
        const questoes = [];
        snapshot.forEach(doc => questoes.push({ ...doc.data(), id: doc.id }));
        iniciarQuiz(questoes, titulo, null, false);
    } catch (error) { alert("Erro: " + error.message); }
}

async function handleLimparCaderno(colecaoNome) {
    if (!confirm("Apagar tudo?")) return;
    try {
        const ref = collection(db, 'users', auth.currentUser.uid, colecaoNome);
        const snapshot = await getDocs(ref);
        const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(promises);
        alert("Limpo!"); loadDashboard(auth.currentUser);
    } catch(e) { console.error(e); }
}

async function handleResetarDesempenho() {
    if(!confirm("Isso apagará TODO histórico. Continuar?")) return;
    appContent.innerHTML = renderLoadingState();
    try {
        const uid = auth.currentUser.uid;
        const deleteSub = async (subName) => {
            const ref = collection(db, 'users', uid, subName);
            const snapshot = await getDocs(ref);
            const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(promises);
        };
        await deleteSub('progresso'); await deleteSub('progresso_temas');
        await deleteSub('questoes_erradas'); await deleteSub('questoes_acertadas');
        await updateDoc(doc(db, 'users', uid), { cicloIndex: 0, sequenciaDias: 0, totalDiasEstudo: 0 });
        alert("Resetado!"); loadDashboard(auth.currentUser);
    } catch (error) { alert("Erro: " + error.message); loadDashboard(auth.currentUser); }
}

function iniciarQuiz(questoes, titulo, tempo = null, modoSimulado = false) {
    quizQuestoes = questoes;
    quizIndexAtual = 0;
    alternativaSelecionada = null;
    respostaConfirmada = false;
    quizTitle = titulo;
    quizReport = { acertos: 0, erros: 0, total: 0 };
    quizTempoRestante = tempo;
    isSimuladoMode = modoSimulado;
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
        if (quizTempoRestante <= 0) { clearInterval(cronometroInterval); alert("Tempo esgotado!"); renderRelatorioFinal(); }
    }, 1000);
}

function renderQuizUI() {
    const questao = quizQuestoes[quizIndexAtual];
    if (!questao) return renderRelatorioFinal();
    let timerHtml = quizTempoRestante ? `<div id="quiz-timer-display" class="font-mono bg-gray-900 text-white px-3 py-1 rounded text-sm">Carregando...</div>` : '';
    const htmlAlts = ['a', 'b', 'c', 'd'].map(letra => {
        const texto = questao.alternativas[letra] || questao.alternativas[letra.toUpperCase()];
        if (!texto) return '';
        return `<div data-alternativa="${letra}" class="p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 mb-3"><span class="font-bold text-gray-400 w-6 uppercase">${letra})</span><span class="flex-1">${texto}</span></div>`;
    }).join('');
    
    const chuteHtml = `<label class="flex items-center gap-2 cursor-pointer mt-4 mb-2 p-2 bg-yellow-50 rounded border border-yellow-200 w-fit"><input type="checkbox" id="chk-chute" class="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"><span class="text-sm font-medium text-yellow-800">🤔 Responder com Dúvida (Chute)</span></label>`;

    appContent.innerHTML = `
        <div class="max-w-3xl mx-auto pb-20">
            <div class="flex justify-between items-center mb-6">
                <div><h2 class="text-xl font-bold text-gray-900">${quizTitle} ${isSimuladoMode ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded ml-2">MODO PROVA</span>' : ''}</h2><p class="text-sm text-gray-500">Questão ${quizIndexAtual + 1} de ${quizQuestoes.length}</p></div>
                ${timerHtml}
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div class="mb-6"><span class="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">${questao.materia}</span><p class="text-lg font-medium text-gray-900 leading-relaxed mt-2">${questao.enunciado}</p></div>
                <div class="space-y-3">${htmlAlts}</div>
                ${chuteHtml}
            </div>
            <div id="quiz-feedback-area" class="hidden mb-20"></div>
            <div class="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-between items-center z-10 md:static md:bg-transparent md:border-0">
                <button data-action="sair-quiz" class="text-gray-500 font-medium hover:text-red-600">Sair</button>
                <button id="btn-quiz-action" data-action="confirmar-resposta" class="bg-gray-900 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-black transition transform active:scale-95">Confirmar</button>
            </div>
        </div>
    `;
}

async function handleConfirmarResposta() {
    if (!alternativaSelecionada) return alert("Selecione uma alternativa!");
    if (respostaConfirmada && !isSimuladoMode) return;
    respostaConfirmada = true;
    const questao = quizQuestoes[quizIndexAtual];
    const correta = String(questao.correta).toLowerCase().trim();
    const selecionada = String(alternativaSelecionada).toLowerCase().trim();
    const acertou = correta === selecionada;
    const isChute = document.getElementById('chk-chute')?.checked || false;
    quizReport.total++;
    if (acertou) quizReport.acertos++; else quizReport.erros++;

    try {
        const userUid = auth.currentUser.uid;
        let materiaKey = "geral";
        for (const [key, values] of Object.entries(MATERIA_VARIACOES)) { if (values.includes(questao.materia)) { materiaKey = key; break; } }
        const progRef = doc(db, 'users', userUid, 'progresso', materiaKey);
        await setDoc(progRef, { totalResolvidas: increment(1), totalAcertos: increment(acertou ? 1 : 0) }, { merge: true });

        if (questao.tema) {
            const temaId = questao.tema.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "_");
            const temaRef = doc(db, 'users', userUid, 'progresso_temas', temaId);
            await setDoc(temaRef, { nomeOriginal: questao.tema, erros: increment(acertou ? 0 : 1) }, { merge: true });
        }

        const collectionName = (acertou && !isChute) ? 'questoes_acertadas' : 'questoes_erradas';
        const cadernoRef = doc(db, 'users', userUid, collectionName, String(questao.id));
        const dataToSave = { ...questao, dataResolucao: Timestamp.now() };
        if (acertou && isChute) dataToSave.revisaoPorChute = true;
        await setDoc(cadernoRef, dataToSave);
        if (acertou && !isChute) await deleteDoc(doc(db, 'users', userUid, 'questoes_erradas', String(questao.id)));
    } catch (e) { console.error("Erro:", e); }

    if (isSimuladoMode) { handleProximaQuestao(); return; }

    const feedbackArea = document.getElementById('quiz-feedback-area');
    feedbackArea.classList.remove('hidden');
    let feedbackClass = acertou ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    let feedbackTitle = acertou ? 'Acertou! 🎉' : 'Errou 😔';
    if (acertou && isChute) { feedbackClass = 'bg-yellow-50 border-yellow-200'; feedbackTitle = 'Acertou (Chute) ⚠️'; }

    feedbackArea.innerHTML = `<div class="p-6 rounded-xl border ${feedbackClass}"><h3 class="font-bold ${acertou ? (isChute ? 'text-yellow-800' : 'text-green-800') : 'text-red-800'} mb-2 text-xl">${feedbackTitle}</h3><p class="text-gray-700 mb-2">A alternativa correta é a <strong>${correta.toUpperCase()}</strong>.</p>${questao.comentario ? `<div class="mt-4 p-4 bg-white/50 rounded text-sm text-gray-800 border border-gray-200"><strong>Comentário:</strong> ${questao.comentario}</div>` : ''}</div>`;
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
        if (quizReturnPath === 'planner') {
            const user = auth.currentUser;
            const ref = doc(db, 'users', user.uid);
            getDoc(ref).then(snap => { updateDoc(ref, { cicloIndex: (snap.data().cicloIndex + 1) % CICLO_DE_ESTUDOS.length }); });
        }
    } else {
        alternativaSelecionada = null; respostaConfirmada = false; renderQuizUI(); window.scrollTo(0,0);
    }
}

function renderRelatorioFinal() {
    const perc = quizReport.total > 0 ? ((quizReport.acertos / quizReport.total) * 100).toFixed(0) : 0;
    appContent.innerHTML = `<div class="text-center max-w-md mx-auto pt-10"><h2 class="text-3xl font-bold text-gray-900 mb-2">Sessão Concluída!</h2><div class="grid grid-cols-3 gap-4 mb-8 mt-8"><div class="bg-green-50 p-4 rounded-xl border border-green-100"><p class="text-xs font-bold text-green-600 uppercase">Acertos</p><p class="text-3xl font-bold text-green-800">${quizReport.acertos}</p></div><div class="bg-red-50 p-4 rounded-xl border border-red-100"><p class="text-xs font-bold text-red-600 uppercase">Erros</p><p class="text-3xl font-bold text-red-800">${quizReport.erros}</p></div><div class="bg-blue-50 p-4 rounded-xl border border-blue-100"><p class="text-xs font-bold text-blue-600 uppercase">Taxa</p><p class="text-3xl font-bold text-blue-800">${perc}%</p></div></div><button data-action="student-voltar-menu" class="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition">Voltar ao Menu Principal</button></div>`;
}

function renderStudentDashboard(userData, stats, topTemas) {
    let temasHtml = topTemas.length > 0 ? `<ul class="space-y-3 mt-4">` + topTemas.map(t => `<li class="flex justify-between items-center text-sm border-b border-gray-100 pb-2"><span class="text-gray-700 truncate w-3/4">${t.nome}</span><span class="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">${t.erros} erros</span></li>`).join('') + `</ul>` : `<p class="text-sm text-gray-400 mt-4 italic">Continue estudando para gerar seu Raio-X.</p>`;
    return `<header class="mb-8"><h1 class="text-3xl font-bold text-gray-900">Olá, <span class="text-blue-600">${userData.nome || 'Aluno'}</span>! 👋</h1><p class="text-gray-500">Sua preparação para a OAB continua.</p></header><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Questões</p><p class="text-2xl font-bold text-gray-900 mt-1">${stats.totalResolvidas}</p></div><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Acertos</p><p class="text-2xl font-bold text-blue-600 mt-1">${stats.taxaGlobal}%</p></div><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Dias</p><p class="text-2xl font-bold text-gray-900 mt-1">${userData.totalDiasEstudo || 0}</p></div><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Sequência</p><p class="text-2xl font-bold text-orange-500 mt-1">🔥 ${userData.sequenciaDias || 0}</p></div></div><div class="grid md:grid-cols-3 gap-6"><div class="md:col-span-2 space-y-4"><h2 class="text-xl font-bold text-gray-800 mb-4">Menu de Estudos</h2><div data-action="show-guided-planner" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex items-center gap-4 group"><div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition"><ion-icon name="calendar"></ion-icon></div><div><h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">Planner Guiado</h3><p class="text-sm text-gray-500">Ciclo automático: ${userData.metaDiaria || 20} questões/dia.</p></div></div><div class="grid grid-cols-2 gap-4"><div data-action="show-caderno-erros" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-red-200 hover:shadow-md transition cursor-pointer"><div class="text-red-500 text-2xl mb-2"><ion-icon name="alert-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Caderno de Erros</h3></div><div data-action="show-caderno-acertos" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition cursor-pointer"><div class="text-green-500 text-2xl mb-2"><ion-icon name="checkmark-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Caderno de Acertos</h3></div></div><div class="grid grid-cols-2 gap-4"><div data-action="show-simulados-menu" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition cursor-pointer"><div class="text-purple-500 text-2xl mb-2"><ion-icon name="document-text"></ion-icon></div><h3 class="font-bold text-gray-900">Simulados</h3></div><div data-action="show-free-study" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 hover:shadow-md transition cursor-pointer"><div class="text-gray-500 text-2xl mb-2"><ion-icon name="library"></ion-icon></div><h3 class="font-bold text-gray-900">Estudo Livre</h3></div></div></div><div class="space-y-6"><div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 class="text-lg font-bold text-gray-900 mb-4">Desempenho Geral</h3><div class="relative h-48 w-full"><canvas id="performanceChart"></canvas></div></div><div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><div class="flex items-center gap-2 mb-2"><ion-icon name="warning" class="text-orange-500"></ion-icon><h3 class="text-lg font-bold text-gray-900">Pontos de Atenção</h3></div><p class="text-xs text-gray-500">Temas que você mais errou recentemente:</p>${temasHtml}</div><div class="text-center pt-2"><button data-action="resetar-desempenho" class="text-xs text-red-400 hover:text-red-600 font-medium">Resetar progresso</button></div></div></div>`;
}

function renderFreeStudyMenu() {
    const botoes = Object.keys(MATERIA_VARIACOES).map(key => {
        const nomeBonito = MATERIA_VARIACOES[key][0];
        return `<button data-action="start-study-session" data-materia="${key}" data-source="freestudy" class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition text-left flex items-center gap-3 group"><div class="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition"></div><span class="font-medium text-gray-700 group-hover:text-blue-700">${nomeBonito}</span></button>`;
    }).join('');
    return `<div class="max-w-4xl mx-auto"><button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><h2 class="text-2xl font-bold text-gray-900 mb-6">Escolha uma Matéria</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${botoes}</div></div>`;
}

function renderSimuladosMenu() {
    function toRoman(num) { const lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}; let roman = ''; for (let i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } } return roman; }
    let optionsHtml = '<option value="">Selecione...</option>';
    for (let i = 45; i >= 4; i--) { const rom = toRoman(i); optionsHtml += `<option value="${i},${rom}">Exame ${rom}</option>`; }
    return `<button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-lg mx-auto mt-8"><h2 class="text-2xl font-bold text-gray-800 mb-6">Simulados</h2><label class="block text-sm font-medium text-gray-700 mb-2">Por Edição</label><select id="select-simulado-edicao" class="w-full p-3 border border-gray-300 rounded-lg mb-4">${optionsHtml}</select><div class="mb-6 bg-gray-50 p-3 rounded border border-gray-200"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chk-modo-real" class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"><span class="text-sm font-bold text-gray-800">🛡️ Modo Prova Real</span></label><p class="text-xs text-gray-500 ml-6 mt-1">Sem feedback imediato. Resultado só no final.</p></div><button data-action="start-simulado-edicao-dropdown" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mb-6">Iniciar Edição</button><hr class="mb-6"><button data-action="start-simulado-assertivo" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">Simulado Assertivo (80 Questões)</button></div>`;
}

function renderPlanner_TarefaDoDia(userData, cicloIndex) {
    const materiaKey = CICLO_DE_ESTUDOS[cicloIndex] || CICLO_DE_ESTUDOS[0];
    const nomeMateria = MATERIA_VARIACOES[materiaKey] ? MATERIA_VARIACOES[materiaKey][0] : materiaKey;
    return `<button data-action="student-voltar-menu" class="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-2"><ion-icon name="arrow-back"></ion-icon> Voltar</button><div class="bg-white p-8 rounded-2xl border-l-8 border-blue-500 shadow-lg max-w-2xl mx-auto mt-10"><h2 class="text-3xl font-bold text-gray-900 mb-2">Meta de Hoje</h2><div class="flex items-center gap-4 mb-8 mt-6"><div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl"><ion-icon name="target"></ion-icon></div><div><p class="text-sm text-gray-500 uppercase font-bold">Matéria do Ciclo</p><p class="text-2xl font-bold text-blue-600 capitalize">${nomeMateria}</p></div></div><button data-action="start-study-session" data-materia="${materiaKey}" data-quantidade="${userData.metaDiaria || 20}" data-source="planner" class="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700 transition shadow-lg">Iniciar ${userData.metaDiaria || 20} Questões</button></div>`;
}

function renderPlannerSetupForm() {
    return `<div class="bg-white p-8 rounded-lg shadow-xl border border-gray-200 max-w-lg mx-auto mt-10"><h2 class="text-2xl font-bold text-gray-900 mb-4">Configurar Planner</h2><p class="text-gray-600 mb-6">Quantas questões você quer fazer por dia?</p><form id="form-planner-setup" class="space-y-4"><input type="number" id="metaDiaria" min="5" value="20" required class="w-full px-4 py-2 border rounded-lg"><button type="submit" class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar e Iniciar</button></form></div>`;
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
            else if (viewName === 'simulados') { quizReturnPath = 'simulados'; appContent.innerHTML = renderSimuladosMenu(); }
        };
    });
}
