import { auth, db, appId } from './auth.js';
import {
doc, getDoc, collection, addDoc, getDocs, query, where, deleteDoc, updateDoc,
setDoc, increment, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- [ 1. SELETORES E DOM ] ---
const appContainer = document.getElementById('app-container');
let appContent = null;

// Usuário atual conhecido dentro do main.js
let currentAppUser = null;

function ensureAppContent() {
if (!appContainer) return null;
let main = appContainer.querySelector('main');
if (!main) {
main = document.createElement('main');
main.className = "flex-1 overflow-y-auto p-4 md:p-8";
appContainer.appendChild(main);
}
let contentDiv = main.querySelector('#dynamic-content');
if (!contentDiv) {
contentDiv = document.createElement('div');
contentDiv.id = 'dynamic-content';
contentDiv.className = "max-w-7xl mx-auto";
main.appendChild(contentDiv);
}
return contentDiv;
}

function getCurrentUserOrThrow() {
if (!currentAppUser || !currentAppUser.uid) {
throw new Error('Usuário não autenticado (currentAppUser null).');
}
return currentAppUser;
}

// --- [ 2. DADOS E CONSTANTES ] ---
const CICLO_DE_ESTUDOS = [
"Ética Profissional", "Direito Constitucional", "Direito Civil",
"Processo Civil", "Direito Penal", "Processo Penal",
"Direito Administrativo", "Direito Tributário", "Direito do Trabalho",
"Processo do Trabalho", "Direito Empresarial"
];

const TODAS_MATERIAS = [
"Ética Profissional", "Direito Civil", "Processo Civil", "Direito Penal",
"Processo Penal", "Direito Constitucional", "Direito Administrativo",
"Direito Tributário", "Direito Empresarial", "Direito do Trabalho",
"Processo do Trabalho", "Direitos Humanos", "Direito do Consumidor",
"Direito Ambiental", "Estatuto da Criança e do Adolescente", "Direito Internacional"
];

// --- [ 3. ESTADO GLOBAL ] ---
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

// --- [ 4. INICIALIZAÇÃO E DIAGNÓSTICO ] ---
window.initApp = async function(user) {
// user vem de auth.js (onAuthStateChanged)
currentAppUser = user;
console.log("🚀 Iniciando App...", user?.uid);
appContent = ensureAppContent();
if (!appContent) return alert("Erro crítico de layout.");
    
};

// --- [ 5. DASHBOARD ] ---
export async function loadDashboard(user) {
if (cronometroInterval) clearInterval(cronometroInterval);
quizTempoRestante = null;
appContent.innerHTML = renderLoadingState();

}

// --- [ AUXILIARES DE NEGÓCIO ] ---
async function atualizarSequenciaDias(userData, userDocRef) {
try {
const hojeStr = getFormattedDate(new Date());
let ultimoLoginData = new Date();
if (userData.ultimoLogin) {
if (userData.ultimoLogin.toDate) ultimoLoginData = userData.ultimoLogin.toDate();
else if (userData.ultimoLogin instanceof Date) ultimoLoginData = userData.ultimoLogin;
else ultimoLoginData = new Date(userData.ultimoLogin);
}
const ultimoLoginStr = getFormattedDate(ultimoLoginData);

}

async function calcularEstatisticasEstudo(uid) {
try {
const progressoRef = collection(db, 'users', uid, 'progresso');
const snapshot = await getDocs(progressoRef);
let totalResolvidas = 0, totalAcertos = 0;
let chartLabels = [], chartData = [];

}

// --- [ 6. GESTOR DE EVENTOS ] ---
if (appContainer) {
appContainer.addEventListener('click', async (e) => {
const btn = e.target.closest('[data-action]');
const alternativa = e.target.closest('[data-alternativa]');

}

function setupNavigation() {
const buttons = document.querySelectorAll('.nav-button');
buttons.forEach(btn => {
btn.onclick = async (e) => {
e.preventDefault();
buttons.forEach(b => {
b.classList.remove('active', 'border-blue-600', 'text-blue-600');
b.classList.add('text-gray-500', 'border-transparent');
});
btn.classList.add('active', 'border-blue-600', 'text-blue-600');
btn.classList.remove('text-gray-500', 'border-transparent');

}

// --- [ 7. LÓGICA DE QUIZ E CARREGAMENTO ] ---
async function abrirPlannerGuiado() {
const user = getCurrentUserOrThrow();
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

async function handleStartStudySession(materia) {
appContent.innerHTML = renderLoadingState();
try {
const q = query(collection(db, 'questoes_oab'), where("materia", "==", materia), limit(50));
const snapshot = await getDocs(q);
if (snapshot.empty) {
appContent.innerHTML = <div class="text-center p-10"><h3 class="text-xl font-bold">Ops!</h3><p class="text-gray-500 mt-2">Nenhuma questão de <strong>"${materia}"</strong> encontrada.</p>${getVoltarButtonHtml()}</div>;
return;
}
const questoes = [];
snapshot.forEach(docSnap => questoes.push({ ...docSnap.data(), id: docSnap.id }));
const user = getCurrentUserOrThrow();
const userDoc = await getDoc(doc(db, 'users', user.uid));
metaQuestoesDoDia = userDoc.data()?.metaDiaria || 20;
iniciarQuiz(questoes, Estudo: ${materia});
} catch (error) {
appContent.innerHTML = renderErrorState(error.message);
}
}

async function handleStartSimuladoDropdown() {
const select = document.getElementById('select-simulado-edicao');
if (!select || !select.value) return alert("Selecione uma edição.");
const [num, rom] = select.value.split(',');
appContent.innerHTML = renderLoadingState();

}

async function handleStartSimuladoAssertivo() {
appContent.innerHTML = renderLoadingState();
try {
const q = query(collection(db, 'questoes_oab'), limit(100));
const snapshot = await getDocs(q);
if (snapshot.empty) {
appContent.innerHTML = <div class="text-center p-10"><p>Banco de questões vazio. Verifique se o upload foi feito.</p>${getVoltarButtonHtml()}</div>;
return;
}
const questoes = [];
snapshot.forEach(docSnap => questoes.push({ ...docSnap.data(), id: docSnap.id }));
questoes.sort(() => Math.random() - 0.5);
const questoesSelecionadas = questoes.slice(0, 80);
iniciarQuiz(questoesSelecionadas, "Simulado Assertivo", 5 * 60 * 60);
} catch (error) {
console.error(error);
appContent.innerHTML = renderErrorState(error.message);
}
}

async function handleStartCaderno(colecaoNome, titulo) {
appContent.innerHTML = renderLoadingState();
try {
const user = getCurrentUserOrThrow();
const ref = collection(db, 'users', user.uid, colecaoNome);
const snapshot = await getDocs(ref);
if (snapshot.empty) {
appContent.innerHTML = <div class="text-center p-10"><p>${titulo} está vazio.</p>${getVoltarButtonHtml()}</div>;
return;
}
const questoes = [];
snapshot.forEach(docSnap => questoes.push({ ...docSnap.data(), id: docSnap.id }));
iniciarQuiz(questoes, titulo);
} catch (error) {
appContent.innerHTML = renderErrorState(error.message);
}
}

// --- [ 8. FUNÇÕES DE MENU E RENDERIZAÇÃO ] ---
async function renderCadernoErrosMenu() {
appContent.innerHTML = renderLoadingState();
let numErros = 0;
try {
const user = getCurrentUserOrThrow();
const ref = collection(db, 'users', user.uid, 'questoes_erradas');
const snap = await getDocs(ref);
numErros = snap.size;
} catch (e) { console.error(e); }

}

async function renderCadernoAcertosMenu() {
appContent.innerHTML = renderLoadingState();
let numAcertos = 0;
try {
const user = getCurrentUserOrThrow();
const ref = collection(db, 'users', user.uid, 'questoes_acertadas');
const snap = await getDocs(ref);
numAcertos = snap.size;
} catch (e) { console.error(e); }

}

function renderAnotacoesMenu() {
appContent.innerHTML = ${getVoltarButtonHtml()} <h2 class="text-2xl font-bold text-gray-800 mb-6 mt-4">Caderno de Anotações</h2> <div class="grid grid-cols-2 md:grid-cols-4 gap-4"> ${TODAS_MATERIAS.map(m =><button data-action="show-anotacoes-editor" data-materia="${m}" class="p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 hover:border-yellow-300 transition capitalize text-left text-yellow-800 font-medium">${m.replace(/_/g, ' ')}</button>).join('')} </div> ;
}

async function renderAnotacoesEditor(materia) {
appContent.innerHTML = renderLoadingState();
let conteudo = "";
try {
const user = getCurrentUserOrThrow();
const docSnap = await getDoc(doc(db, 'users', user.uid, 'anotacoes', materia));
if (docSnap.exists()) conteudo = docSnap.data().conteudo || "";
} catch(e) { console.error(e); }

}

async function handleSalvarAnotacao(materia, conteudo) {
try {
const user = getCurrentUserOrThrow();
await setDoc(doc(db, 'users', user.uid, 'anotacoes', materia), { materia, conteudo, updatedAt: Timestamp.now() }, { merge: true });
} catch(e) { console.error("Erro salvar nota:", e); }
}

async function handleLimparCaderno(colecaoNome) {
if (!confirm("Tem a certeza?")) return;
appContent.innerHTML = renderLoadingState();
try {
const user = getCurrentUserOrThrow();
const ref = collection(db, 'users', user.uid, colecaoNome);
const snapshot = await getDocs(ref);
const promises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
await Promise.all(promises);
alert("Caderno limpo.");
await loadDashboard({ uid: user.uid });
} catch (e) {
alert("Erro: " + e.message);
const user = getCurrentUserOrThrow();
await loadDashboard({ uid: user.uid });
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
appContent.innerHTML = renderQuizUI();
if (tempo) startCronometro();
}

// cronômetro simples
function startCronometro() {
if (cronometroInterval) clearInterval(cronometroInterval);
cronometroInterval = setInterval(() => {
if (quizTempoRestante === null) return;
quizTempoRestante--;
if (quizTempoRestante <= 0) {
clearInterval(cronometroInterval);
renderRelatorioFinal();
} else {
const timerEl = document.querySelector('#app-container .font-mono');
if (timerEl) {
const h = Math.floor(quizTempoRestante / 3600).toString().padStart(2, '0');
const m = Math.floor((quizTempoRestante % 3600) / 60).toString().padStart(2, '0');
timerEl.textContent = ${h}:${m};
}
}
}, 1000);
}

async function handleConfirmarResposta() {
if (!alternativaSelecionada) return alert("Selecione uma alternativa.");
if (respostaConfirmada) return;
respostaConfirmada = true;
const questao = quizQuestoes[quizIndexAtual];
const correta = String(questao.correta).toLowerCase();
const selecionada = String(alternativaSelecionada).toLowerCase();
const acertou = selecionada === correta;

}

async function handleProximaQuestao() {
quizIndexAtual++;
const fimPorMeta = quizReturnPath === 'menu' && quizIndexAtual >= metaQuestoesDoDia;
if (quizIndexAtual >= quizQuestoes.length || fimPorMeta) renderRelatorioFinal();
else {
alternativaSelecionada = null;
respostaConfirmada = false;
appContent.innerHTML = renderQuizUI();
}
}

function renderRelatorioFinal() {
const textoBotao = "Voltar ao Menu";
const textoFinal = Você completou ${quizReport.total} questões com ${quizReport.acertos} acertos.;
appContent.innerHTML = renderQuizReport(quizReport, textoFinal, textoBotao);
if (quizReturnPath === 'menu') {
const user = getCurrentUserOrThrow();
const ref = doc(db, 'users', user.uid);
getDoc(ref).then(snap => {
const idx = snap.data().cicloIndex || 0;
const novoIdx = (idx + 1) % CICLO_DE_ESTUDOS.length;
updateDoc(ref, { cicloIndex: novoIdx });
});
}
}

function renderErrorState(msg) {
return <div class="flex flex-col items-center justify-center h-64 text-center"><div class="text-red-500 text-4xl mb-2"><ion-icon name="alert-circle"></ion-icon></div><p class="text-gray-500">${msg}</p><button onclick="location.reload()" class="text-blue-600 hover:underline mt-4">Recarregar</button></div>;
}

function renderStudentDashboard(userData, stats) {
const s = stats || { totalResolvidas: 0, taxaGlobal: 0, chartLabels: [], chartData: [] };
return <header class="mb-8"><h1 class="text-3xl font-bold text-gray-900">Olá, <span class="text-blue-600">${userData.nome || 'Aluno'}</span>! 👋</h1><p class="text-gray-500">Vamos continuar a sua preparação.</p></header> <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"> <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Questões</p><p class="text-2xl font-bold text-gray-900 mt-1">${s.totalResolvidas}</p></div> <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Acertos</p><p class="text-2xl font-bold text-blue-600 mt-1">${s.taxaGlobal}%</p></div> <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Dias</p><p class="text-2xl font-bold text-gray-900 mt-1">${userData.totalDiasEstudo || 0}</p></div> <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold">Sequência</p><p class="text-2xl font-bold text-orange-500 mt-1">🔥 ${userData.sequenciaDias || 0}</p></div> </div> <div class="grid md:grid-cols-3 gap-6"> <div class="md:col-span-2 space-y-4"> <h2 class="text-xl font-bold text-gray-800 mb-4">Menu de Estudos</h2> <div data-action="show-guided-planner" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex items-center gap-4 group"> <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition"><ion-icon name="calendar"></ion-icon></div> <div><h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">Planner Guiado</h3><p class="text-sm text-gray-500">Ciclo automático.</p></div> </div> <div class="grid grid-cols-2 gap-4"> <div data-action="show-caderno-erros" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-red-200 hover:shadow-md transition cursor-pointer"> <div class="text-red-500 text-2xl mb-2"><ion-icon name="alert-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Erros</h3> </div> <div data-action="show-caderno-acertos" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition cursor-pointer"> <div class="text-green-500 text-2xl mb-2"><ion-icon name="checkmark-circle"></ion-icon></div><h3 class="font-bold text-gray-900">Acertos</h3> </div> </div> <div class="grid grid-cols-2 gap-4"> <div data-action="show-simulados-menu" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition cursor-pointer"> <div class="text-purple-500 text-2xl mb-2"><ion-icon name="document-text"></ion-icon></div><h3 class="font-bold text-gray-900">Simulados</h3> </div> <div data-action="show-free-study" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 hover:shadow-md transition cursor-pointer"> <div class="text-gray-500 text-2xl mb-2"><ion-icon name="library"></ion-icon></div><h3 class="font-bold text-gray-900">Estudo Livre</h3> </div> </div> <div data-action="show-anotacoes-menu" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-yellow-400 hover:shadow-md transition cursor-pointer flex items-center gap-4"> <div class="text-yellow-500 text-2xl"><ion-icon name="book"></ion-icon></div><h3 class="font-bold text-gray-900">Anotações</h3> </div> </div> <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100"> <h3 class="text-lg font-bold text-gray-900 mb-4">Desempenho</h3> <div class="relative h-64 w-full">${s.chartLabels.length > 0 ? 'anvas id="performanceChart"></canvas>' : '<p class="text-center text-gray-400 mt-10 text-sm">Sem dados.</p>'}</div> <div class="mt-6 pt-4 border-t border-gray-100 text-center"><button data-action="resetar-desempenho" class="text-xs text-red-400 hover:text-red-600 font-medium">Resetar</button></div> </div> </div> ;
}

function renderQuizUI() {
const questao = quizQuestoes[quizIndexAtual];
const meta = (quizReturnPath === 'menu') ? metaQuestoesDoDia : quizQuestoes.length;
let timerHtml = quizTempoRestante ? <div class="font-mono bg-gray-900 text-white px-3 py-1 rounded text-sm">${Math.floor(quizTempoRestante/3600).toString().padStart(2,'0')}:${Math.floor((quizTempoRestante%3600)/60).toString().padStart(2,'0')}</div> : '';
let altsHtml = '';
['A','B','C','D'].forEach(letra => {
const texto = questao.alternativas[letra] || questao.alternativas[letra.toLowerCase()];
if (texto) altsHtml += <div data-alternativa="${letra}" class="p-4 border rounded-lg cursor-pointer transition flex items-start gap-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50"><span class="font-bold text-gray-400 w-6">${letra})</span><span class="flex-1">${texto}</span></div>;
});
return <div class="max-w-3xl mx-auto"> <div class="flex justify-between items-center mb-6"><div><h2 class="text-xl font-bold text-gray-900">${quizTitle}</h2><p class="text-sm text-gray-500">Q. ${quizIndexAtual + 1} / ${meta}</p></div>${timerHtml}</div> <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6"> <div class="mb-6"><span class="inline-block bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded mb-2 uppercase">${questao.materia || 'Geral'}</span><p class="text-lg font-medium text-gray-900 leading-relaxed">${questao.enunciado}</p></div> <div class="space-y-3">${altsHtml}</div> </div> <div id="quiz-comentario" class="hidden bg-blue-50 border border-blue-100 p-6 rounded-xl mb-6"><h3 class="font-bold text-blue-900 mb-2">Gabarito</h3><p class="text-blue-800 text-sm">${questao.comentario || 'Sem comentário.'}</p></div> <div class="flex justify-between items-center"><button data-action="sair-quiz" class="text-gray-500 hover:text-gray-700">Sair</button><button id="quiz-action-btn" data-action="confirmar-resposta" class="bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition shadow-md">Confirmar</button></div> </div> ;
}

function renderQuizReport(report, textoFinal, textoBotao) {
const taxa = (report.total > 0) ? ((report.acertos / report.total) * 100).toFixed(0) : 0;
return <div class="text-center max-w-lg mx-auto pt-10"><h1 class="text-3xl font-bold text-gray-900 mb-4">Concluído! 🎉</h1><p class="text-gray-500 mb-8 text-lg">${textoFinal}</p><div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8"><div class="grid grid-cols-3 gap-4"><div><p class="text-xs font-bold text-gray-400 uppercase">Acertos</p><p class="text-3xl font-bold text-green-600">${report.acertos}</p></div><div><p class="text-xs font-bold text-gray-400 uppercase">Erros</p><p class="text-3xl font-bold text-red-500">${report.erros}</p></div><div><p class="text-xs font-bold text-gray-400 uppercase">Taxa</p><p class="text-3xl font-bold text-blue-600">${taxa}%</p></div></div></div><button data-action="sair-quiz" class="bg-gray-900 text-white font-semibold py-3 px-8 rounded-lg hover:bg-gray-800 transition shadow-lg">${textoBotao}</button></div>;
}

function renderLoadingState() {
return <div class="flex h-full items-center justify-center p-20"><div class="spinner"></div></div>;
}
function getVoltarButtonHtml() {
return <button data-action="student-voltar-menu" class="mt-4 text-blue-600 hover:underline">Voltar ao Menu</button>;
}
function getFormattedDate(date) {
return ${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')};
}
function renderFreeStudyMenu() {
return ${getVoltarButtonHtml()}<h2 class="text-2xl font-bold text-gray-800 mb-6 mt-4">Estudo Livre</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">${TODAS_MATERIAS.map(m => <button data-action="start-study-session" data-materia="${m}" class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition capitalize text-left">${m}</button>).join('')}</div>;
}
function renderPlanner_TarefaDoDia(userData, cicloIndex) {
const materia = CICLO_DE_ESTUDOS[cicloIndex] || CICLO_DE_ESTUDOS;
return ${getVoltarButtonHtml()}<div class="bg-white p-8 rounded-2xl border-l-8 border-blue-500 shadow-lg max-w-2xl mx-auto mt-10"><h2 class="text-3xl font-bold text-gray-900 mb-2">Sua Meta de Hoje</h2><p class="text-gray-500 text-lg mb-8">Foco total na aprovação.</p><div class="flex items-center gap-4 mb-8"><div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl"><ion-icon name="target"></ion-icon></div><div><p class="text-sm text-gray-500 uppercase font-bold">Matéria do Ciclo</p><p class="text-2xl font-bold text-blue-600 capitalize">${materia}</p></div></div><button data-action="start-study-session" data-materia="${materia}" class="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700 transition shadow-lg transform hover:-translate-y-1">Iniciar ${userData.metaDiaria} Questões</button></div>;
}
function renderPlannerSetupForm() {
return ${getVoltarButtonHtml()}<div class="bg-white p-8 rounded-lg shadow-xl border border-gray-700 max-w-lg mx-auto mt-10"><h2 class="text-2xl font-bold text-gray-900 mb-4">Configurar Meta</h2><form id="form-planner-setup" class="space-y-4"><div><input type="number" id="metaDiaria" name="metaDiaria" min="5" value="20" required class="w-full px-4 py-2 border rounded-lg"></div><button type="submit" class="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar e Iniciar</button></form></div>;
}
function renderAdminDashboard(userData) {
return <div class="p-8 text-center"><h1 class="text-2xl font-bold">Painel Admin</h1><p>Olá ${userData.nome}. Funcionalidades de admin em construção.</p><button data-action="student-voltar-menu" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Voltar</button></div>;
}
// Funções vazias para features não críticas
async function renderListQuestionsUI() { alert("Lista de questões em breve."); }
function renderCreateQuestionForm() { return <p>Em breve</p>; }
async function handleCreateQuestionSubmit() {}
async function handleSavePlannerSetup(form) {
const meta = form.metaDiaria.value;
const user = getCurrentUserOrThrow();
try {
await updateDoc(doc(db, 'users', user.uid), { metaDiaria: parseInt(meta), cicloIndex: 0 });
await abrirPlannerGuiado();
} catch(e) { console.error(e); }
}
async function handleDeleteQuestion() {}
async function handleResetarDesempenho() {
const user = getCurrentUserOrThrow();
const ref = collection(db, 'users', user.uid, 'progresso');
const snap = await getDocs(ref);
const promises = snap.docs.map(d => deleteDoc(d.ref));
await Promise.all(promises);
alert("Desempenho resetado.");
await loadDashboard({ uid: user.uid });
}
