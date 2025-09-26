// WM Prova Online - JavaScript
// Sistema de provas online para professores e alunos

// Global variables
let currentUser = null;
let currentExam = null;
let examTimer = null;
let examStartTime = null;
let examDuration = 0;
let examQuestions = [];
let studentAnswers = {};
let studentResponseId = null; 
let currentStudentResponse = null;
let exitAttempts = 0;
let isExamMode = false;
let initialGracePeriod = false; 
let lastExitTimestamp = 0;      

// API Configuration
const API_BASE = 'https://script.google.com/macros/s/AKfycbwr4CwGenJ8Gf10svE3zOA_QiQJ3kAyZ9KyqNUT0NGQkImmJ68MkOX_tZnjFCJOD8XA/exec';

// Utility Functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').style.display = 'flex';
}

function hideAlert() {
    document.getElementById('alertModal').style.display = 'none';
}

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';
    
    document.getElementById('confirmYesBtn').onclick = () => {
        hideConfirm();
        callback(true);
    };
    
    document.getElementById('confirmNoBtn').onclick = () => {
        hideConfirm();
        callback(false);
    };
}

function hideConfirm() {
    document.getElementById('confirmModal').style.display = 'none';
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('pt-BR');
}

function formatCPF(cpf) {
    // Se o CPF não existir (for nulo ou vazio), retorna uma string vazia.
    if (!cpf) {
        return '';
    }
    // Converte o CPF para String (texto) e então aplica a formatação.
    return String(cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    return cpf.length === 11;
}

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showUserInfo(userName) {
    document.getElementById('userName').textContent = userName;
    document.getElementById('userInfo').style.display = 'flex';
}

function hideUserInfo() {
    document.getElementById('userInfo').style.display = 'none';
}

// API Functions
async function apiRequest(tabela, method = 'GET', data = null) {
    showLoading();

    // JSONP for GET requests
    if (method === 'GET') {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            window[callbackName] = function(data) {
                delete window[callbackName];
                document.body.removeChild(script);
                hideLoading();
                if (data.success) {
                    resolve(data);
                } else {
                    console.error('API Error (JSONP):', data.erro);
                    showAlert('Erro de API', data.erro || 'Ocorreu um erro ao buscar os dados.');
                    reject(data);
                }
            };

            const script = document.createElement('script');
            script.src = `${API_BASE}?tabela=${tabela}&key=${API_KEY}&callback=${callbackName}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                hideLoading();
                const errorMsg = 'Não foi possível conectar ao servidor. Verifique a URL da API e a sua conexão.';
                console.error('API Error:', errorMsg);
                showAlert('Erro de Conexão', errorMsg);
                reject(errorMsg);
            };
            document.body.appendChild(script);
        });
    }

    // Fetch with CORS for POST requests (as per Google Apps Script example)
    if (method === 'POST') {
        try {
            const url = new URL(API_BASE);
            url.searchParams.append('tabela', tabela);
            url.searchParams.append('key', API_KEY);

            const response = await fetch(url.toString(), {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Required by Google Apps Script
                },
                mode: 'no-cors' // POST requests to Apps Script often need this
            });
            
            hideLoading();
            // no-cors mode doesn't allow reading the response, so we assume success
            return { success: true }; 

        } catch (error) {
            hideLoading();
            console.error("API POST Error:", error);
            showAlert("Erro", "Erro de conexão ao salvar os dados. Tente novamente.");
            return null;
        }
    }

    // Fetch with CORS for PUT requests
    if (method === "PUT") {
        try {
            const url = new URL(API_BASE);
            url.searchParams.append("tabela", tabela);
            url.searchParams.append("key", API_KEY);

            const response = await fetch(url.toString(), {
                method: "POST", // Google Apps Script uses doPost for PUT actions
                body: JSON.stringify({ ...data, action: "update" }), // Add action for GAS
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                },
                mode: "no-cors",
            });

            hideLoading();
            return { success: true };
        } catch (error) {
            hideLoading();
            console.error("API PUT Error:", error);
            showAlert("Erro", "Erro de conexão ao atualizar os dados. Tente novamente.");
            return null;
        }
    }
}

// Professor Functions
async function loginProfessor(usuario, senha) {
    const users = await apiRequest('usuario');
    console.log("Usuarios recebidos:", users);
    console.log("Digitado:", usuario, senha);
    if (!users || !users.data) {
        showAlert('Erro', 'Erro ao verificar credenciais.');
        return false;
    }
    
    const user = users.data.find(u => u.usuario === usuario && u.senha === senha);
    if (user) {
        currentUser = user;
        showUserInfo(usuario);
        showScreen('professorDashboard');
        loadProvas();
        return true;
    } else {
        showAlert('Erro', 'Usuário ou senha incorretos.');
        return false;
    }
}

async function loadProvas() {
    const provas = await apiRequest('prova');
    if (!provas || !provas.data) return;
    
    const provasList = document.getElementById('provasList');
    const provaSelectQuestoes = document.getElementById('provaSelectQuestoes');
    const provaSelectRespostas = document.getElementById('provaSelectRespostas');
    
    // Clear existing content
    provasList.innerHTML = '';
    provaSelectQuestoes.innerHTML = '<option value="">Selecione uma prova</option>';
    provaSelectRespostas.innerHTML = '<option value="">Selecione uma prova</option>';
    
    provas.data.forEach(prova => {
        // Add to list
        const provaCard = createProvaCard(prova);
        provasList.appendChild(provaCard);
        
        // Add to selects
        const option1 = document.createElement('option');
        option1.value = prova.id_prova;
        option1.textContent = prova.titulo;
        provaSelectQuestoes.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = prova.id_prova;
        option2.textContent = prova.titulo;
        provaSelectRespostas.appendChild(option2);
    });
}

function createProvaCard(prova) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const now = new Date();
    const startDate = new Date(prova.data_inicio);
    const endDate = new Date(prova.data_fim);
    
    let status = 'Agendada';
    let statusColor = '#6c757d';
    
    if (now >= startDate && now <= endDate) {
        status = 'Ativa';
        statusColor = '#28a745';
    } else if (now > endDate) {
        status = 'Finalizada';
        statusColor = '#dc3545';
    }
    
    card.innerHTML = `
        <div class="item-header">
            <h4 class="item-title">${prova.titulo}</h4>
            <div class="item-actions">
                <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${status}</span>
                <button class="btn btn-secondary" onclick="editProva(${prova.id_prova})">Editar</button>
                <button class="btn btn-danger" onclick="deleteProva(${prova.id_prova})">Excluir</button>
            </div>
        </div>
        <div class="item-details">
            <div class="item-detail">
                <strong>Início:</strong>
                <span>${formatDateTime(prova.data_inicio)}</span>
            </div>
            <div class="item-detail">
                <strong>Fim:</strong>
                <span>${formatDateTime(prova.data_fim)}</span>
            </div>
            <div class="item-detail">
                <strong>Duração:</strong>
                <span>${prova.duracao_minutos} minutos</span>
            </div>
            <div class="item-detail">
                <strong>Nota Máxima:</strong>
                <span>${prova.nota_maxima}</span>
            </div>
        </div>
    `;
    
    return card;
}

async function saveProva(formData) {
    const id_prova = formData.get("id_prova");
    const data = {
        id_prova: id_prova || Date.now(),
        titulo: formData.get("titulo"),
        data_inicio: formData.get("data_inicio"),
        data_fim: formData.get("data_fim"),
        duracao_minutos: parseInt(formData.get("duracao_minutos")),
        nota_maxima: parseFloat(formData.get("nota_maxima"))
    };

    let result;
    if (id_prova) {
        // If id_prova exists, it's an update
        result = await apiRequest("prova", "PUT", data);
    } else {
        // Otherwise, it's a new entry
        result = await apiRequest("prova", "POST", data);
    }

    if (result && result.success) {
        hideProvaForm();
        loadProvas();
        showAlert("Sucesso", "Prova salva com sucesso!");
    } else {
        showAlert("Erro", "Erro ao salvar prova.");
    }
}

function showProvaForm(prova = null) {
    const form = document.getElementById('provaFormElement');
    const title = document.getElementById('provaFormTitle');
    
    if (prova) {
        title.textContent = 'Editar Prova';
        form.id_prova.value = prova.id_prova;
        form.titulo.value = prova.titulo;
        form.data_inicio.value = prova.data_inicio;
        form.data_fim.value = prova.data_fim;
        form.duracao_minutos.value = prova.duracao_minutos;
        form.nota_maxima.value = prova.nota_maxima;
    } else {
        title.textContent = 'Nova Prova';
        form.reset();
        form.id_prova.value = '';
    }
    
    document.getElementById('provaForm').style.display = 'flex';
}

function hideProvaForm() {
    document.getElementById('provaForm').style.display = 'none';
}

async function editProva(id) {
    const provas = await apiRequest('prova');
    if (!provas || !provas.data) return;
    
    const prova = provas.data.find(p => p.id_prova == id);
    if (prova) {
        showProvaForm(prova);
    }
}

async function deleteProva(id) {
    showConfirm('Confirmar Exclusão', 'Tem certeza que deseja excluir esta prova?', async (confirmed) => {
        if (confirmed) {
            const result = await apiRequest('prova', 'POST', { id_prova: id, action: 'delete' });
            if (result && result.success) {
                loadProvas();
                showAlert('Sucesso', 'Prova excluída com sucesso!');
            } else {
                showAlert('Erro', 'Erro ao excluir prova.');
            }
        }
    });
}

// Questions Management
async function loadQuestoes(provaId) {
    if (!provaId) {
        document.getElementById('questoesList').innerHTML = '';
        return;
    }
    
    const questoes = await apiRequest('questao');
    if (!questoes || !questoes.data) return;
    
    const provaQuestoes = questoes.data.filter(q => q.id_prova == provaId);
    const questoesList = document.getElementById('questoesList');
    questoesList.innerHTML = '';
    
    provaQuestoes.forEach(questao => {
        const questaoCard = createQuestaoCard(questao);
        questoesList.appendChild(questaoCard);
    });
}

function createQuestaoCard(questao) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    card.innerHTML = `
        <div class="item-header">
            <h4 class="item-title">Questão ${questao.id_questao}</h4>
            <div class="item-actions">
                <span style="background: ${questao.tipo === 'objetiva' ? '#007bff' : '#28a745'}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${questao.tipo}</span>
                <button class="btn btn-secondary" onclick="editQuestao(${questao.id_questao})">Editar</button>
                <button class="btn btn-danger" onclick="deleteQuestao(${questao.id_questao})">Excluir</button>
            </div>
        </div>
        <div class="item-details">
            <div class="item-detail">
                <strong>Enunciado:</strong>
                <span>${questao.enunciado}</span>
            </div>
            <div class="item-detail">
                <strong>Peso:</strong>
                <span>${questao.peso}</span>
            </div>
            ${questao.tipo === 'objetiva' ? `
                <div class="item-detail">
                    <strong>Resposta Correta:</strong>
                    <span>${questao.resposta_correta}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

async function saveQuestao(formData) {
    const id_questao = formData.get("id_questao");
    const tipo = formData.get("tipo");
    const data = {
        id_questao: id_questao || Date.now(),
        id_prova: formData.get("id_prova"),
        tipo: tipo,
        enunciado: formData.get("enunciado"),
        peso: parseFloat(formData.get("peso"))
    };

    // Clear objective options if the question type is discursive
    if (tipo === "objetiva") {
        data.opcao_a = formData.get("opcao_a") || "";
        data.opcao_b = formData.get("opcao_b") || "";
        data.opcao_c = formData.get("opcao_c") || "";
        data.opcao_d = formData.get("opcao_d") || "";
        data.opcao_e = formData.get("opcao_e") || "";
        data.resposta_correta = formData.get("resposta_correta") || "";
    } else {
        data.opcao_a = "";
        data.opcao_b = "";
        data.opcao_c = "";
        data.opcao_d = "";
        data.opcao_e = "";
        data.resposta_correta = "";
    }

    let result;
    if (id_questao) {
        // If id_questao exists, it's an update
        result = await apiRequest("questao", "PUT", data);
    } else {
        // Otherwise, it's a new entry
        result = await apiRequest("questao", "POST", data);
    }

    if (result && result.success) {
        hideQuestaoForm();
        loadQuestoes(data.id_prova);
        showAlert("Sucesso", "Questão salva com sucesso!");
    } else {
        showAlert("Erro", "Erro ao salvar questão.");
    }
}

function showQuestaoForm(questao = null) {
    const form = document.getElementById('questaoFormElement');
    const title = document.getElementById('questaoFormTitle');
    const provaId = document.getElementById('provaSelectQuestoes').value;
    
    if (!provaId) {
        showAlert('Erro', 'Selecione uma prova primeiro.');
        return;
    }
    
    if (questao) {
        title.textContent = 'Editar Questão';
        form.id_questao.value = questao.id_questao;
        form.id_prova.value = questao.id_prova;
        form.tipo.value = questao.tipo;
        form.enunciado.value = questao.enunciado;
        form.opcao_a.value = questao.opcao_a || '';
        form.opcao_b.value = questao.opcao_b || '';
        form.opcao_c.value = questao.opcao_c || '';
        form.opcao_d.value = questao.opcao_d || '';
        form.opcao_e.value = questao.opcao_e || '';
        form.resposta_correta.value = questao.resposta_correta || '';
        form.peso.value = questao.peso;
        
        toggleOpcoesObjetivas(questao.tipo === 'objetiva');
    } else {
        title.textContent = 'Nova Questão';
        form.reset();
        form.id_questao.value = '';
        form.id_prova.value = provaId;
        toggleOpcoesObjetivas(true);
    }
    
    document.getElementById('questaoForm').style.display = 'flex';
}

function hideQuestaoForm() {
    document.getElementById('questaoForm').style.display = 'none';
}

function toggleOpcoesObjetivas(show) {
    const opcoesDiv = document.getElementById('opcoesObjetivas');
    opcoesDiv.style.display = show ? 'block' : 'none';
}

async function editQuestao(id) {
    const questoes = await apiRequest('questao');
    if (!questoes || !questoes.data) return;
    
    const questao = questoes.data.find(q => q.id_questao == id);
    if (questao) {
        showQuestaoForm(questao);
    }
}

async function deleteQuestao(id) {
    showConfirm('Confirmar Exclusão', 'Tem certeza que deseja excluir esta questão?', async (confirmed) => {
        if (confirmed) {
            const result = await apiRequest('questao', 'POST', { id_questao: id, action: 'delete' });
            if (result && result.success) {
                const provaId = document.getElementById('provaSelectQuestoes').value;
                loadQuestoes(provaId);
                showAlert('Sucesso', 'Questão excluída com sucesso!');
            } else {
                showAlert('Erro', 'Erro ao excluir questão.');
            }
        }
    });
}

// Responses Management
async function loadRespostas(provaId) {
    if (!provaId) {
        document.getElementById('respostasList').innerHTML = '';
        return;
    }

    const respostas = await apiRequest('resposta');
    if (!respostas || !respostas.data) {
        document.getElementById('respostasList').innerHTML = '<p>Nenhuma resposta encontrada.</p>';
        return;
    }

    // CORREÇÃO DEFINITIVA: Usamos '==' para comparar o texto do menu com o número da planilha.
    const provaRespostas = respostas.data.filter(r => r.id_prova == provaId);
    
    const respostasList = document.getElementById('respostasList');
    respostasList.innerHTML = '';

    if (provaRespostas.length === 0) {
        respostasList.innerHTML = '<p>Nenhuma resposta encontrada para esta prova. Verifique a planilha.</p>';
    } else {
        provaRespostas.forEach(resposta => {
            const respostaCard = createRespostaCard(resposta);
            respostasList.appendChild(respostaCard);
        });
    }
}

function createRespostaCard(resposta) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const notaFinal = (resposta.nota_objetiva || 0) + (resposta.nota_discursiva || 0);
    
    card.innerHTML = `
        <div class="item-header">
            <h4 class="item-title">${resposta.nome}</h4>
            <div class="item-actions">
                <button class="btn btn-primary" onclick="viewRespostas(${resposta.id_resposta})">Ver Respostas</button>
                <button class="btn btn-secondary" onclick="editNotaDiscursiva(${resposta.id_resposta})">Nota Discursiva</button>
            </div>
        </div>
        <div class="item-details">
            <div class="item-detail">
                <strong>Email:</strong>
                <span>${resposta.email}</span>
            </div>
            <div class="item-detail">
                <strong>CPF:</strong>
                <span>${formatCPF(resposta.cpf)}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Objetiva:</strong>
                <span>${resposta.nota_objetiva || 0}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Discursiva:</strong>
                <span>${resposta.nota_discursiva || 0}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Final:</strong>
                <span style="font-weight: bold; color: #667eea;">${notaFinal}</span>
            </div>
            <div class="item-detail">
                <strong>Tentativas de Sair:</strong>
                <span>${resposta.tentativas_de_sair || 0}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Student Functions
async function checkActiveExam() {
    const provas = await apiRequest('prova');
    if (!provas || !provas.data) {
        showAlert('Erro', 'Não foi possível verificar provas ativas.');
        return null;
    }
    
    const now = new Date();
    const activeExam = provas.data.find(prova => {
        const startDate = new Date(prova.data_inicio);
        const endDate = new Date(prova.data_fim);
        return now >= startDate && now <= endDate;
    });
    
    return activeExam;
}

async function startExam(studentData) {
    const activeExam = await checkActiveExam();
    if (!activeExam) {
        showAlert('Erro', 'Não há prova ativa no momento.');
        return;
    }
    
    // Check if student already has a response
    const respostas = await apiRequest('resposta');
    if (respostas && respostas.data) {
        const existingResponse = respostas.data.find(r => 
            r.id_prova == activeExam.id_prova && r.cpf === studentData.cpf
        );
        
        if (existingResponse && existingResponse.hora_fim) {
            showAlert('Erro', 'Você já finalizou esta prova.');
            return;
        }
        
        if (existingResponse) {
            // Resume exam
            currentStudentResponse = existingResponse;
            studentResponseId = existingResponse.id_resposta;
            currentExam = activeExam;
            studentAnswers = JSON.parse(existingResponse.respostas || '{}');
            examStartTime = new Date(existingResponse.hora_login);
            await loadExamQuestions();
            showExamScreen();
            return;
        }
    }
    
    // Create new response record
    const responseData = {
        id_resposta: Date.now(),
        id_prova: activeExam.id_prova,
        nome: studentData.nome,
        email: studentData.email,
        cpf: studentData.cpf,
        ip: await getUserIP(),
        hora_login: new Date().toISOString(),
        respostas: '{}',
        tentativas_de_sair: 0,
    };
    currentStudentResponse = responseData; 
    studentResponseId = responseData.id_resposta; 

    const result = await apiRequest('resposta', 'POST', responseData);
    if (result && result.success) {
        currentExam = activeExam;
        examStartTime = new Date();
        studentAnswers = {};
        await loadExamQuestions();
        showExamScreen();
    } else {
        showAlert('Erro', 'Erro ao iniciar prova.');
    }
}

async function getUserIP() {
    return new Promise((resolve) => {
        const callbackName = 'jsonp_ip_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data.ip || 'unknown');
        };

        const script = document.createElement('script');
        script.src = `https://api.ipify.org?format=jsonp&callback=${callbackName}`;
        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve('unknown');
        };
        document.body.appendChild(script);
    });
}

async function loadExamQuestions() {
    const questoes = await apiRequest('questao');
    if (!questoes || !questoes.data) return;
    
    examQuestions = questoes.data.filter(q => q.id_prova == currentExam.id_prova);
    examDuration = currentExam.duracao_minutos * 60; // Convert to seconds
    
    renderExamQuestions();
    startExamTimer();
}

function renderExamQuestions() {
    const questionsContainer = document.getElementById('examQuestions');
    questionsContainer.innerHTML = '';
    
    examQuestions.forEach((question, index) => {
        const questionCard = createExamQuestionCard(question, index + 1);
        questionsContainer.appendChild(questionCard);
    });
}

function createExamQuestionCard(question, number) {
    const card = document.createElement('div');
    card.className = 'question-card';
    
    let optionsHtml = '';
    if (question.tipo === 'objetiva') {
        const options = ['A', 'B', 'C', 'D', 'E'];
        optionsHtml = '<div class="question-options">';
        
        options.forEach(option => {
            const optionText = question[`opcao_${option.toLowerCase()}`];
            if (optionText) {
                const isChecked = studentAnswers[question.id_questao] === option ? 'checked' : '';
                optionsHtml += `
                    <div class="option-item">
                        <input type="radio" name="question_${question.id_questao}" value="${option}" ${isChecked} 
                               onchange="saveAnswer(${question.id_questao}, '${option}')">
                        <span class="option-text">${option}) ${optionText}</span>
                    </div>
                `;
            }
        });
        
        optionsHtml += '</div>';
    } else {
        const savedAnswer = studentAnswers[question.id_questao] || '';
        optionsHtml = `
            <textarea class="question-textarea" placeholder="Digite sua resposta aqui..." 
                      onchange="saveAnswer(${question.id_questao}, this.value)">${savedAnswer}</textarea>
        `;
    }
    
    card.innerHTML = `
        <div class="question-header">
            <span class="question-number">Questão ${number}</span>
            <span class="question-type">${question.tipo}</span>
        </div>
        <div class="question-text">${question.enunciado}</div>
        ${optionsHtml}
    `;
    
    return card;
}

function saveAnswer(questionId, answer) {
    studentAnswers[questionId] = answer;
}

function showExamScreen() {
    document.getElementById('examTitle').textContent = currentExam.titulo;
    showScreen('examScreen');
    enableExamMode();
}

// Adicione esta variável no topo do seu script.js, junto com as outras
let fullscreenCheckInterval = null;

/**
 * Função ATUALIZADA que verifica o estado da tela cheia.
 * Agora ela será chamada pelo evento 'fullscreenchange' para uma resposta instantânea.
 */
function checkFullscreen() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const warningOverlay = document.getElementById('fullscreenWarning');

    if (warningOverlay) {
        // Se o modo de prova está ativo E não estamos em tela cheia, mostra o aviso.
        if (isExamMode && !isFullscreen) {
            warningOverlay.style.display = 'flex';
        } else {
            // Se o modo de prova não está ativo OU se já estamos em tela cheia, esconde o aviso.
            warningOverlay.style.display = 'none';
        }
    }
}

// NOVA FUNÇÃO para centralizar a contagem
function incrementExitCounter() {
    if (!isExamMode || initialGracePeriod) return;

    const now = Date.now();
    // Se a última saída foi a menos de 2 segundos atrás, ignora esta.
    if (now - lastExitTimestamp < 2000) {
        return;
    }
    lastExitTimestamp = now;

    exitAttempts++;
    showAlert('Aviso', `Você saiu da janela ou do modo tela cheia ${exitAttempts} vez(es). O número de saídas será levado em consideração na correção da prova.`);
}

/**
 * Função ATUALIZADA para habilitar o modo de prova.
 * Agora adiciona listeners para o evento 'fullscreenchange'.
 */
// Função ATUALIZADA para habilitar o modo de prova
function enableExamMode() {
    isExamMode = true;
    initialGracePeriod = true; // Ativa o período de carência
    lastExitTimestamp = 0;
    setTimeout(() => { initialGracePeriod = false; }, 3000); // Carência de 3s para não contar a 1ª saída

    document.body.classList.add('exam-mode');
    
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
    
    // Listeners de Segurança
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Listener para quando o ALUNO TROCA DE ABA/JANELA
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            incrementExitCounter();
        }
    });

    // Listener para quando o ALUNO SAI DA TELA CHEIA (ESC ou F11)
    const fullscreenChangeHandler = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Apenas chama o contador se a prova já estiver iniciada (sem carência)
            incrementExitCounter();
        }
        // Esta função apenas cuida do AVISO VISUAL, não da contagem
        checkFullscreen();
    };
    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);

    if (fullscreenCheckInterval) clearInterval(fullscreenCheckInterval);
    fullscreenCheckInterval = setInterval(checkFullscreen, 500);
    
    checkFullscreen();
}

/**
 * Função ATUALIZADA para desabilitar o modo de prova.
 * Agora remove os listeners do evento 'fullscreenchange'.
 */
function disableExamMode() {
    isExamMode = false;
    document.body.classList.remove('exam-mode');
    
    // Para a verificação contínua
    if (fullscreenCheckInterval) {
        clearInterval(fullscreenCheckInterval);
        fullscreenCheckInterval = null;
    }
    
    // Remove os listeners de segurança
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    // **REMOVE OS LISTENERS DA TELA CHEIA**
    document.removeEventListener('fullscreenchange', checkFullscreen);
    document.removeEventListener('webkitfullscreenchange', checkFullscreen);

    // Garante que o aviso seja escondido ao sair
    const warningOverlay = document.getElementById('fullscreenWarning');
    if (warningOverlay) warningOverlay.style.display = 'none';

    // Sai da tela cheia se ainda estiver ativa
    if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
    }
}

function handleVisibilityChange() {
    if (isExamMode && document.hidden) {
        exitAttempts++;
        showAlert('Aviso', 'Tentativa de sair da janela registrada. Mantenha-se na prova.');
    }
}

function handleKeyDown(event) {
    if (isExamMode) {
        // Block copy/paste and other shortcuts
        if (event.ctrlKey && (event.key === 'c' || event.key === 'v' || event.key === 'x' || 
                              event.key === 'u' || event.key === 'i' || event.key === 's')) {
            event.preventDefault();
            showAlert('Bloqueado', 'Esta ação não é permitida durante a prova.');
        }
        
        // Block F12, F5, etc.
        if (event.key === 'F12' || event.key === 'F5' || 
            (event.ctrlKey && event.shiftKey && event.key === 'I')) {
            event.preventDefault();
            showAlert('Bloqueado', 'Esta ação não é permitida durante a prova.');
        }
    }
}

function handleContextMenu(event) {
    if (isExamMode) {
        event.preventDefault();
        showAlert('Bloqueado', 'Menu de contexto não é permitido durante a prova.');
    }
}

function handleBeforeUnload(event) {
    if (isExamMode) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
}

function startExamTimer() {
    const timerElement = document.getElementById('timer');
    const startTime = examStartTime.getTime();
    const duration = examDuration * 1000; // Convert to milliseconds
    
    examTimer = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = duration - elapsed;
        
        if (remaining <= 0) {
            clearInterval(examTimer);
            finishExam(true); // Auto-finish
            return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running out
        if (remaining < 300000) { // 5 minutes
            timerElement.style.color = '#dc3545';
        } else if (remaining < 600000) { // 10 minutes
            timerElement.style.color = '#ffc107';
        }
    }, 1000);
}

async function finishExam(autoFinish = false) {
    if (examTimer) {
        clearInterval(examTimer);
    }
    
    // Calculate objective score
    let objectiveScore = 0;
    examQuestions.forEach(question => {
        if (question.tipo === 'objetiva' && studentAnswers[question.id_questao] === question.resposta_correta) {
            objectiveScore += parseFloat(question.peso);
        }
    });
    
    // Update response
    const updateData = {
        ...currentStudentResponse, // Começa com todos os dados originais do aluno
        id_resposta: studentResponseId, 
        respostas: JSON.stringify(studentAnswers),
        hora_fim: new Date().toISOString(),
        nota_objetiva: objectiveScore,
        tentativas_de_sair: exitAttempts
    };
    
    const result = await apiRequest('resposta', 'PUT', updateData); 
    
    disableExamMode();
    
    if (autoFinish) {
        document.getElementById('resultMessage').textContent = 'Seu tempo de prova expirou. Você não pode mais responder.';
    } else {
        document.getElementById('resultMessage').textContent = 'Prova finalizada com sucesso!';
    }
    
    showScreen('resultScreen');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Navigation buttons
    document.getElementById('professorLoginBtn').addEventListener('click', () => {
        showScreen('professorLoginScreen');
    });
    
    document.getElementById('studentAccessBtn').addEventListener('click', () => {
        showScreen('studentAccessScreen');
    });
    
    document.getElementById('backToHomeFromLogin').addEventListener('click', () => {
        showScreen('homeScreen');
    });
    
    document.getElementById('backToHomeFromStudent').addEventListener('click', () => {
        showScreen('homeScreen');
    });
    
    document.getElementById('backToHomeFromResult').addEventListener('click', () => {
        showScreen('homeScreen');
        currentExam = null;
        studentAnswers = {};
        exitAttempts = 0;
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        currentUser = null;
        hideUserInfo();
        showScreen('homeScreen');
    });
    
    // Professor login form
    document.getElementById('professorLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await loginProfessor(formData.get('usuario'), formData.get('senha'));
    });
    
    // Student access form
    document.getElementById('studentAccessForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const cpf = formData.get('cpf').replace(/[^\d]/g, '');
        if (!validateCPF(cpf)) {
            showAlert('Erro', 'CPF inválido.');
            return;
        }
        
        const studentData = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            cpf: cpf
        };
        
        await startExam(studentData);
    });
    
    // Dashboard tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update tab buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });
    
    // Prova form
    document.getElementById('addProvaBtn').addEventListener('click', () => {
        showProvaForm();
    });
    
    document.getElementById('cancelProvaForm').addEventListener('click', () => {
        hideProvaForm();
    });
    
    document.getElementById('provaFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await saveProva(formData);
    });
    
    // Questao form
    document.getElementById('provaSelectQuestoes').addEventListener('change', (e) => {
        const provaId = e.target.value;
        document.getElementById('addQuestaoBtn').disabled = !provaId;
        loadQuestoes(provaId);
    });
    
    document.getElementById('addQuestaoBtn').addEventListener('click', () => {
        showQuestaoForm();
    });
    
    document.getElementById('cancelQuestaoForm').addEventListener('click', () => {
        hideQuestaoForm();
    });
    
    document.getElementById('questaoTipo').addEventListener('change', (e) => {
        toggleOpcoesObjetivas(e.target.value === 'objetiva');
    });
    
    document.getElementById('questaoFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await saveQuestao(formData);
    });
    
    // Respostas
    document.getElementById('provaSelectRespostas').addEventListener('change', (e) => {
        loadRespostas(e.target.value);
    });
    
    // Exam
    document.getElementById('submitExamBtn').addEventListener('click', () => {
        showConfirm('Finalizar Prova', 'Tem certeza que deseja finalizar a prova?', (confirmed) => {
            if (confirmed) {
                finishExam();
            }
        });
    });
    
    // Modal close buttons
    document.getElementById('alertOkBtn').addEventListener('click', hideAlert);
    
    // CPF formatting
    document.getElementById('studentCPF').addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            e.target.value = value;
        }
    });

     // Adicione esta parte no final, dentro da função
    document.getElementById('enterFullscreenBtn').addEventListener('click', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    });
});

// Global functions for HTML onclick events
window.editProva = editProva;
window.deleteProva = deleteProva;
window.editQuestao = editQuestao;
window.deleteQuestao = deleteQuestao;
window.saveAnswer = saveAnswer;



// Additional functions for viewing responses and editing discursive grades
async function viewRespostas(respostaId) {
    showLoading();
    const [respostas, questoes] = await Promise.all([
        apiRequest('resposta'),
        apiRequest('questao')
    ]);
    hideLoading();

    if (!respostas || !respostas.data || !questoes || !questoes.data) {
        return showAlert('Erro', 'Não foi possível carregar os dados necessários.');
    }

    const resposta = respostas.data.find(r => r.id_resposta == respostaId);
    if (!resposta) return showAlert('Erro', 'Registro de resposta não encontrado.');

    const provaQuestoes = questoes.data.filter(q => q.id_prova == resposta.id_prova);
    
    let respostasData = {};
    // A linha mais importante: lê o JSON puro da planilha
    if (resposta.respostas && typeof resposta.respostas === 'string' && resposta.respostas.length > 2) {
        try {
            respostasData = JSON.parse(resposta.respostas);
        } catch (e) {
            console.error("O JSON na planilha está corrompido:", resposta.respostas, e);
        }
    }
    
    const modalContentEl = document.getElementById('viewResponseContent');
    let modalContent = `
        <h3>Respostas de ${resposta.nome}</h3>
        <div style="max-height: 70vh; overflow-y: auto; text-align: left;">
    `;
    
    provaQuestoes.forEach((questao, index) => {
        const respAluno = respostasData[questao.id_questao] || '<i>Não respondida.</i>';
        
        modalContent += `
            <div style="margin-bottom: 2rem; padding: 1rem; border: 1px solid #e1e5e9; border-radius: 8px;">
                <h4>Questão ${index + 1} (${questao.tipo})</h4>
                <p><strong>Enunciado:</strong> ${questao.enunciado}</p>
                <p><strong>Resposta do aluno:</strong><pre style="white-space: pre-wrap; word-wrap: break-word; margin-top: 5px;">${respAluno}</pre></p>
                ${questao.tipo === 'objetiva' ? `<p><strong>Resposta correta:</strong> ${questao.resposta_correta}</p>` : ''}
                <p><strong>Peso:</strong> ${questao.peso}</p>
            </div>
        `;
    });
    
    modalContent += `
        </div>
        <div class="button-group" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="closeViewRespostas()">Fechar</button>
        </div>
    `;
    
    modalContentEl.innerHTML = modalContent;
    document.getElementById('viewResponseModal').style.display = 'flex';
}

function closeViewRespostas() {
    document.getElementById('viewResponseModal').style.display = 'none';
    document.getElementById('viewResponseContent').innerHTML = ''; // Limpa o conteúdo
}


async function editNotaDiscursiva(respostaId) {
    const respostas = await apiRequest('resposta');
    if (!respostas || !respostas.data) return;
    
    const resposta = respostas.data.find(r => r.id_resposta == respostaId);
    if (!resposta) return;
    
    const notaAtual = resposta.nota_discursiva || 0;
    
    // O código abaixo cria o pop-up para editar a nota
    const modalContent = `
        <div id="notaModal" class="form-modal" style="display: flex;">
            <div class="form-card">
                <h3>Editar Nota Discursiva</h3>
                <p><strong>Aluno:</strong> ${resposta.nome}</p>
                <form id="notaDiscursivaForm">
                    <div class="form-group">
                        <label for="notaDiscursivaInput">Nota Discursiva:</label>
                        <input type="number" id="notaDiscursivaInput" step="0.1" value="${notaAtual}" required>
                    </div>
                    <div class="button-group">
                        <button type="submit" class="btn btn-primary">Salvar Nota</button>
                        <button type="button" class="btn btn-secondary" onclick="closeNotaDiscursiva()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Adiciona o evento de submit ao formulário do pop-up
    document.getElementById('notaDiscursivaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const novaNotaDiscursiva = parseFloat(document.getElementById('notaDiscursivaInput').value);
        const notaObjetiva = parseFloat(resposta.nota_objetiva) || 0;

        // CRIA O OBJETO DE DADOS COMPLETO PARA ATUALIZAÇÃO
        const updateData = {
            ...resposta, // Copia todos os dados existentes da resposta
            nota_discursiva: novaNotaDiscursiva, // Atualiza a nota discursiva
            nota_final: notaObjetiva + novaNotaDiscursiva // Recalcula a nota final
        };
        
        // USA O MÉTODO 'PUT' PARA ATUALIZAR A LINHA SEM APAGAR NADA
        const result = await apiRequest('resposta', 'PUT', updateData);

        if (result && result.success) {
            closeNotaDiscursiva();
            const provaId = document.getElementById('provaSelectRespostas').value;
            loadRespostas(provaId); // Recarrega a lista para mostrar a nota atualizada
            showAlert('Sucesso', 'Nota discursiva salva com sucesso!');
        } else {
            showAlert('Erro', 'Erro ao salvar nota discursiva.');
        }
    });
}

// Garanta que a função para fechar o modal também exista
function closeNotaDiscursiva() {
    const modal = document.getElementById('notaModal');
    if (modal) {
        modal.remove();
    }
}

// Enhanced API request function with better error handling
async function apiRequestEnhanced(tabela, method = 'GET', data = null) {
    try {
        showLoading();
        
        const url = new URL(API_BASE);
        url.searchParams.append('tabela', tabela);
        url.searchParams.append('key', API_KEY);
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        };
        
        if (data && method === 'POST') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url.toString(), options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        hideLoading();
        
        return result;
    } catch (error) {
        hideLoading();
        console.error('API Error:', error);
        
        // Show more specific error messages
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
        } else if (error.message.includes('HTTP error')) {
            showAlert('Erro do Servidor', 'O servidor retornou um erro. Tente novamente em alguns minutos.');
        } else {
            showAlert('Erro', 'Erro inesperado. Tente novamente.');
        }
        
        return null;
    }
}





// Add global functions for HTML onclick events
window.viewRespostas = viewRespostas;
window.editNotaDiscursiva = editNotaDiscursiva;
window.closeViewRespostas = closeViewRespostas;
window.closeNotaDiscursiva = closeNotaDiscursiva;


// Additional UI/UX enhancements and security improvements

// Auto-save student answers periodically
let autoSaveInterval = null;

function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(async () => {
        if (isExamMode && Object.keys(studentAnswers).length > 0) {
            try {
                const updateData = {
                    respostas: JSON.stringify(studentAnswers),
                    tentativas_de_sair: exitAttempts
                };
                
                // Silent save without showing loading
                await fetch(API_BASE + '?tabela=resposta&key=' + API_KEY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
            } catch (error) {
                console.log('Auto-save failed:', error);
            }
        }
    }, 30000); // Auto-save every 30 seconds
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

// Enhanced exam mode with additional security
function enhancedExamMode() {
    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // Disable drag and drop
    document.addEventListener('dragstart', preventDefaultAction);
    document.addEventListener('drop', preventDefaultAction);
    document.addEventListener('dragover', preventDefaultAction);
    
    // Disable print
    window.addEventListener('beforeprint', preventDefaultAction);
    
    // Monitor focus changes
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    // Start auto-save
    startAutoSave();
}

function disableEnhancedExamMode() {
    // Re-enable text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.mozUserSelect = '';
    document.body.style.msUserSelect = '';
    
    // Remove event listeners
    document.removeEventListener('dragstart', preventDefaultAction);
    document.removeEventListener('drop', preventDefaultAction);
    document.removeEventListener('dragover', preventDefaultAction);
    window.removeEventListener('beforeprint', preventDefaultAction);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    
    // Stop auto-save
    stopAutoSave();
}

function preventDefaultAction(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
}

function handleWindowBlur() {
    if (isExamMode) {
        exitAttempts++;
        console.log('Window lost focus - attempt:', exitAttempts);
    }
}

function handleWindowFocus() {
    if (isExamMode && exitAttempts > 0) {
        showAlert('Aviso', `Você saiu da janela ${exitAttempts} vez(es). Mantenha o foco na prova.`);
    }
}

// Enhanced timer with visual warnings
function enhancedTimer() {
    const timerElement = document.getElementById('timer');
    const startTime = examStartTime.getTime();
    const duration = examDuration * 1000;
    
    examTimer = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = duration - elapsed;
        
        if (remaining <= 0) {
            clearInterval(examTimer);
            finishExam(true);
            return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Enhanced visual warnings
        if (remaining < 60000) { // 1 minute
            timerElement.style.color = '#dc3545';
            timerElement.style.animation = 'pulse 1s infinite';
        } else if (remaining < 300000) { // 5 minutes
            timerElement.style.color = '#dc3545';
            timerElement.style.animation = 'none';
        } else if (remaining < 600000) { // 10 minutes
            timerElement.style.color = '#ffc107';
            timerElement.style.animation = 'none';
        } else {
            timerElement.style.color = '#28a745';
            timerElement.style.animation = 'none';
        }
    }, 1000);
}

// Add pulse animation to CSS
function addPulseAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Progress indicator for exam
function addProgressIndicator() {
    const examContainer = document.querySelector('.exam-container');
    if (!examContainer) return;
    
    const progressHtml = `
        <div id="examProgress" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span>Progresso da Prova</span>
                <span id="progressText">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #e1e5e9; border-radius: 4px; overflow: hidden;">
                <div id="progressBar" style="height: 100%; background: #667eea; width: 0%; transition: width 0.3s ease;"></div>
            </div>
        </div>
    `;
    
    examContainer.insertAdjacentHTML('afterbegin', progressHtml);
}

function updateProgress() {
    const totalQuestions = examQuestions.length;
    const answeredQuestions = Object.keys(studentAnswers).length;
    const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar && progressText) {
        progressBar.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '%';
    }
}

// Enhanced save answer function with progress update
function enhancedSaveAnswer(questionId, answer) {
    studentAnswers[questionId] = answer;
    updateProgress();
}

// Keyboard shortcuts for professor dashboard
function addKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (!isExamMode && currentUser) {
            // Ctrl+N for new exam
            if (event.ctrlKey && event.key === 'n') {
                event.preventDefault();
                if (document.getElementById('professorDashboard').classList.contains('active')) {
                    showProvaForm();
                }
            }
            
            // Ctrl+Q for new question
            if (event.ctrlKey && event.key === 'q') {
                event.preventDefault();
                const provaId = document.getElementById('provaSelectQuestoes').value;
                if (provaId) {
                    showQuestaoForm();
                }
            }
        }
    });
}

// Enhanced form validation
function enhanceFormValidation() {
    // Real-time CPF validation
    const cpfInput = document.getElementById('studentCPF');
    if (cpfInput) {
        cpfInput.addEventListener('blur', (e) => {
            const cpf = e.target.value.replace(/[^\d]/g, '');
            if (cpf.length > 0 && !validateCPF(cpf)) {
                e.target.style.borderColor = '#dc3545';
                e.target.setCustomValidity('CPF inválido');
            } else {
                e.target.style.borderColor = '#28a745';
                e.target.setCustomValidity('');
            }
        });
    }
    
    // Email validation
    const emailInput = document.getElementById('studentEmail');
    if (emailInput) {
        emailInput.addEventListener('blur', (e) => {
            const email = e.target.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email.length > 0 && !emailRegex.test(email)) {
                e.target.style.borderColor = '#dc3545';
                e.target.setCustomValidity('Email inválido');
            } else {
                e.target.style.borderColor = '#28a745';
                e.target.setCustomValidity('');
            }
        });
    }
}

// Initialize enhanced features
function initializeEnhancements() {
    addPulseAnimation();
    addKeyboardShortcuts();
    enhanceFormValidation();
    
    // Override existing functions with enhanced versions
    window.saveAnswer = enhancedSaveAnswer;
    window.startExamTimer = enhancedTimer;
    
    // Add progress indicator when exam starts
    const originalShowExamScreen = showExamScreen;
    window.showExamScreen = function() {
        originalShowExamScreen();
        setTimeout(() => {
            addProgressIndicator();
            updateProgress();
        }, 100);
    };
    
    // Enhanced exam mode
    const originalEnableExamMode = enableExamMode;
    window.enableExamMode = function() {
        originalEnableExamMode();
        enhancedExamMode();
    };
    
    const originalDisableExamMode = disableExamMode;
    window.disableExamMode = function() {
        originalDisableExamMode();
        disableEnhancedExamMode();
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancements);
} else {
    initializeEnhancements();
}

// Add accessibility improvements
function addAccessibilityFeatures() {
    // Add ARIA labels
    document.querySelectorAll('button').forEach(button => {
        if (!button.getAttribute('aria-label') && button.textContent) {
            button.setAttribute('aria-label', button.textContent.trim());
        }
    });
    
    // Add focus management
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            // Ensure focus is visible
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
}

// Initialize accessibility features
addAccessibilityFeatures();

// Add CSS for keyboard navigation
const accessibilityStyle = document.createElement('style');
accessibilityStyle.textContent = `
    .keyboard-navigation *:focus {
        outline: 2px solid #667eea !important;
        outline-offset: 2px !important;
    }
    
    .keyboard-navigation .btn:focus {
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3) !important;
    }
`;
document.head.appendChild(accessibilityStyle);


// Local testing mode with mock data


// Mock data for local testing


// Override the global apiRequest function for local testing


