
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
let exitAttempts = 0;
let isExamMode = false;

// API Configuration
const API_BASE = 'https://script.google.com/macros/s/AKfycbwr4CwGenJ8Gf10svE3zOA_QiQJ3kAyZ9KyqNUT0NGQkImmJ68MkOX_tZnjFCJOD8XA/exec';
const API_KEY = 'carambola@01';

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
    const alertOkBtn = document.getElementById('alertOkBtn');
    if (alertOkBtn) {
        // Clear previous event listeners to prevent multiple firings
        const newAlertOkBtn = alertOkBtn.cloneNode(true);
        alertOkBtn.parentNode.replaceChild(newAlertOkBtn, alertOkBtn);
        newAlertOkBtn.addEventListener('click', hideAlert);
    }
}

function hideAlert() {
    document.getElementById('alertModal').style.display = 'none';
}

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';
    
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    const confirmNoBtn = document.getElementById('confirmNoBtn');

    // Clear previous event listeners
    if (confirmYesBtn) {
        const newConfirmYesBtn = confirmYesBtn.cloneNode(true);
        confirmYesBtn.parentNode.replaceChild(newConfirmYesBtn, confirmYesBtn);
        newConfirmYesBtn.addEventListener('click', () => {
            hideConfirm();
            callback(true);
        });
    }
    if (confirmNoBtn) {
        const newConfirmNoBtn = confirmNoBtn.cloneNode(true);
        confirmNoBtn.parentNode.replaceChild(newConfirmNoBtn, confirmNoBtn);
        newConfirmNoBtn.addEventListener('click', () => {
            hideConfirm();
            callback(false);
        });
    }
}

function hideConfirm() {
    document.getElementById('confirmModal').style.display = 'none';
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return ''; // Validate date
    return date.toLocaleString('pt-BR');
}

function formatCPF(cpf) {
    if (!cpf) return '';
    cpf = String(cpf).replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function validateCPF(cpf) {
    cpf = String(cpf).replace(/\D/g, '');
    return cpf.length === 11;
}

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none'; // Explicitly hide
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block'; // Explicitly show
    } else {
        console.error(`Erro: Tela com ID '${screenId}' não encontrada.`);
    }
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
            window[callbackName] = function(response) {
                delete window[callbackName];
                const scriptElement = document.getElementById(callbackName + '_script');
                if (scriptElement) document.body.removeChild(scriptElement);
                hideLoading();
                if (response && response.success) {
                    resolve(response);
                } else {
                    console.error('API Error (JSONP):', response ? response.erro : 'Resposta inválida da API.');
                    showAlert('Erro de API', response ? response.erro : 'Ocorreu um erro ao buscar os dados.');
                    reject(response);
                }
            };

            const script = document.createElement('script');
            script.id = callbackName + '_script';
            script.src = `${API_BASE}?tabela=${tabela}&key=${API_KEY}&callback=${callbackName}`;
            script.onerror = () => {
                delete window[callbackName];
                const scriptElement = document.getElementById(callbackName + '_script');
                if (scriptElement) document.body.removeChild(scriptElement);
                hideLoading();
                const errorMsg = 'Não foi possível conectar ao servidor. Verifique a URL da API e a sua conexão.';
                console.error('API Error:', errorMsg);
                showAlert('Erro de Conexão', errorMsg);
                reject(new Error(errorMsg));
            };
            document.body.appendChild(script);
        });
    }

    // Fetch with CORS for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
        try {
            const url = new URL(API_BASE);
            url.searchParams.append('tabela', tabela);
            url.searchParams.append('key', API_KEY);

            // For PUT, add action: "update" to the data payload
            const payload = method === 'PUT' ? { ...data, action: 'update' } : data;

            const response = await fetch(url.toString(), {
                method: 'POST', // Google Apps Script uses doPost for both POST and PUT actions
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Required by Google Apps Script
                },
                mode: 'no-cors' // Use no-cors for cross-origin requests to Apps Script
            });
            
            hideLoading();
            // In no-cors mode, we cannot read the response, so we assume success for now.
            // The Apps Script should handle the actual success/failure logic.
            return { success: true }; 

        } catch (error) {
            hideLoading();
            console.error(`API ${method} Error:`, error);
            showAlert('Erro', `Erro de conexão ao ${method === 'PUT' ? 'atualizar' : 'salvar'} os dados. Tente novamente.`);
            return null;
        }
    }
}

// Professor Functions
async function loginProfessor(usuario, senha) {
    const users = await apiRequest('usuario');
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
        result = await apiRequest("prova", "PUT", data);
    } else {
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

// Questoes Functions
async function loadQuestoes(provaId) {
    const questoesList = document.getElementById('questoesList');
    questoesList.innerHTML = '';

    if (!provaId) {
        questoesList.innerHTML = '<p>Selecione uma prova para ver as questões.</p>';
        return;
    }

    const questoes = await apiRequest('questao');
    if (!questoes || !questoes.data) return;

    const provaQuestoes = questoes.data.filter(q => q.id_prova == provaId);

    if (provaQuestoes.length === 0) {
        questoesList.innerHTML = '<p>Nenhuma questão encontrada para esta prova.</p>';
        return;
    }

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
        result = await apiRequest("questao", "PUT", data);
    } else {
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
    } else {
        title.textContent = 'Nova Questão';
        form.reset();
        form.id_questao.value = '';
        form.id_prova.value = provaId;
        form.tipo.value = 'objetiva'; // Default to objetiva
        // Clear options when creating new question
        form.opcao_a.value = '';
        form.opcao_b.value = '';
        form.opcao_c.value = '';
        form.opcao_d.value = '';
        form.opcao_e.value = '';
        form.resposta_correta.value = '';
    }
    
    // Toggle objective options visibility based on question type
    toggleObjectiveOptions(form.tipo.value);
    
    document.getElementById('questaoForm').style.display = 'flex';
}

function hideQuestaoForm() {
    document.getElementById('questaoForm').style.display = 'none';
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
                loadQuestoes(document.getElementById('provaSelectQuestoes').value);
                showAlert('Sucesso', 'Questão excluída com sucesso!');
            } else {
                showAlert('Erro', 'Erro ao excluir questão.');
            }
        }
    });
}

function toggleObjectiveOptions(type) {
    const objectiveOptions = document.getElementById('objectiveOptions');
    if (objectiveOptions) {
        if (type === 'objetiva') {
            objectiveOptions.style.display = 'block';
        } else {
            objectiveOptions.style.display = 'none';
        }
    }
}

// Respostas Functions
async function loadRespostas(provaId) {
    const respostasList = document.getElementById('respostasList');
    respostasList.innerHTML = '';

    if (!provaId) {
        respostasList.innerHTML = '<p>Selecione uma prova para ver as respostas.</p>';
        return;
    }

    const respostas = await apiRequest('resposta');
    if (!respostas || !respostas.data) {
        respostasList.innerHTML = '<p>Nenhuma resposta encontrada para esta prova.</p>';
        return;
    }

    const provaRespostas = respostas.data.filter(r => r.id_prova == provaId);

    if (provaRespostas.length === 0) {
        respostasList.innerHTML = '<p>Nenhuma resposta encontrada para esta prova.</p>';
        return;
    }

    // Create table header
    let tableHTML = `
        <table class="responses-table">
            <thead>
                <tr>
                    <th>ID Resposta</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>CPF</th>
                    <th>IP</th>
                    <th>Login</th>
                    <th>Fim</th>
                    <th>Respostas</th>
                    <th>Nota Obj.</th>
                    <th>Nota Disc.</th>
                    <th>Nota Final</th>
                    <th>Tentativas Sair</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Add rows to table
    provaRespostas.forEach(resposta => {
        // Attempt to parse 'respostas' field if it's a stringified JSON
        let parsedRespostas = {};
        try {
            parsedRespostas = JSON.parse(resposta.respostas || '{}');
        } catch (e) {
            console.error('Error parsing respostas JSON:', e);
            parsedRespostas = { 'Erro': 'JSON inválido' };
        }

        tableHTML += `
            <tr>
                <td>${resposta.id_resposta}</td>
                <td>${resposta.nome}</td>
                <td>${resposta.email}</td>
                <td>${formatCPF(resposta.cpf)}</td>
                <td>${resposta.ip || 'N/A'}</td>
                <td>${formatDateTime(resposta.hora_login)}</td>
                <td>${formatDateTime(resposta.hora_fim)}</td>
                <td><pre>${JSON.stringify(parsedRespostas, null, 2)}</pre></td>
                <td>${resposta.nota_objetiva || ''}</td>
                <td>${resposta.nota_discursiva || ''}</td>
                <td>${resposta.nota_final || ''}</td>
                <td>${resposta.tentativas_de_sair || ''}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;
    respostasList.innerHTML = tableHTML;
}

// Student Functions
async function startExam() {
    showLoading();
    try {
        const studentName = document.getElementById('studentName').value;
        const studentEmail = document.getElementById('studentEmail').value;
        const studentCpf = document.getElementById('studentCpf').value;
        const provaId = document.getElementById('studentProvaSelect').value;

        if (!studentName || !studentEmail || !studentCpf || !provaId) {
            showAlert('Erro', 'Por favor, preencha todos os campos e selecione uma prova.');
            hideLoading();
            return;
        }

        if (!validateCPF(studentCpf)) {
            showAlert('Erro', 'CPF inválido. Por favor, insira um CPF válido com 11 dígitos.');
            hideLoading();
            return;
        }

        // Fetch prova details
        const provas = await apiRequest('prova');
        if (!provas || !provas.data) {
            showAlert('Erro', 'Não foi possível carregar os detalhes da prova.');
            hideLoading();
            return;
        }
        const prova = provas.data.find(p => p.id_prova == provaId);
        if (!prova) {
            showAlert('Erro', 'Prova selecionada não encontrada.');
            hideLoading();
            return;
        }

        // Check if exam is active
        const now = new Date();
        const startDate = new Date(prova.data_inicio);
        const endDate = new Date(prova.data_fim);

        if (now < startDate) {
            showAlert('Aviso', 'A prova ainda não começou. Data de início: ' + formatDateTime(prova.data_inicio));
            hideLoading();
            return;
        }
        if (now > endDate) {
            showAlert('Aviso', 'A prova já terminou. Data de término: ' + formatDateTime(prova.data_fim));
            hideLoading();
            return;
        }

        // Fetch questions for the prova
        const questoes = await apiRequest('questao');
        if (!questoes || !questoes.data) {
            showAlert('Erro', 'Não foi possível carregar as questões da prova.');
            hideLoading();
            return;
        }
        examQuestions = questoes.data.filter(q => q.id_prova == provaId);
        if (examQuestions.length === 0) {
            showAlert('Erro', 'Nenhuma questão encontrada para esta prova.');
            hideLoading();
            return;
        }

        // Get student IP address
        let studentIp = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            studentIp = ipData.ip;
        } catch (ipError) {
            console.warn('Could not fetch IP address:', ipError);
        }

        // Check for existing response to update or create new
        const existingResponses = await apiRequest('resposta');
        let existingStudentResponse = null;
        if (existingResponses && existingResponses.data) {
            existingStudentResponse = existingResponses.data.find(r => 
                r.id_prova == provaId && r.cpf == studentCpf
            );
        }

        if (existingStudentResponse) {
            // Resume existing exam
            currentExam = {
                id_resposta: existingStudentResponse.id_resposta,
                id_prova: provaId,
                nome: studentName,
                email: studentEmail,
                cpf: studentCpf,
                ip: studentIp,
                hora_login: existingStudentResponse.hora_login, // Keep original login time
                hora_fim: '',
                respostas: JSON.parse(existingStudentResponse.respostas || '{}'),
                nota_objetiva: existingStudentResponse.nota_objetiva || 0,
                nota_discursiva: existingStudentResponse.nota_discursiva || 0,
                nota_final: existingStudentResponse.nota_final || 0,
                tentativas_de_sair: existingStudentResponse.tentativas_de_sair || 0
            };
            studentAnswers = currentExam.respostas; // Load existing answers
            showAlert('Aviso', 'Você está retomando uma prova existente.');
        } else {
            // Start new exam
            currentExam = {
                id_resposta: Date.now(), // Generate new ID
                id_prova: provaId,
                nome: studentName,
                email: studentEmail,
                cpf: studentCpf,
                ip: studentIp,
                hora_login: new Date().toISOString(),
                hora_fim: '',
                respostas: {},
                nota_objetiva: 0,
                nota_discursiva: 0,
                nota_final: 0,
                tentativas_de_sair: 0
            };
            studentAnswers = {};
            // Save initial response record (POST)
            await apiRequest('resposta', 'POST', currentExam);
        }

        // Set exam details
        document.getElementById('examTitle').textContent = prova.titulo;
        examDuration = prova.duracao_minutos * 60; // Convert to seconds
        examStartTime = new Date();
        
        // Render questions
        renderExamQuestions();
        startExamTimer();
        
        // Enable exam mode (fullscreen, anti-cheat)
        const examModeEnabled = await enableExamMode();
        if (!examModeEnabled) {
            hideLoading();
            return; // Exit if exam mode couldn't be enabled
        }
        showScreen('examScreen');

    } catch (error) {
        console.error('Erro ao iniciar prova:', error);
        showAlert('Erro', 'Não foi possível iniciar a prova. Tente novamente mais tarde.');
    } finally {
        hideLoading();
    }
}

function renderExamQuestions() {
    const examQuestionsContainer = document.getElementById('examQuestionsContainer');
    examQuestionsContainer.innerHTML = '';

    examQuestions.forEach((questao, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-card';
        questionElement.dataset.id = questao.id_questao;

        let optionsHTML = '';
        if (questao.tipo === 'objetiva') {
            const options = ['a', 'b', 'c', 'd', 'e'];
            optionsHTML = '<div class="question-options">';
            options.forEach(optionKey => {
                const optionText = questao[`opcao_${optionKey}`];
                if (optionText) {
                    const isChecked = studentAnswers[questao.id_questao] === optionKey;
                    optionsHTML += `
                        <label class="option-item">
                            <input type="radio" name="question_${questao.id_questao}" value="${optionKey}" ${isChecked ? 'checked' : ''}>
                            <span class="option-text">${optionText}</span>
                        </label>
                    `;
                }
            });
            optionsHTML += '</div>';
        } else if (questao.tipo === 'discursiva') {
            const currentAnswer = studentAnswers[questao.id_questao] || '';
            optionsHTML = `
                <textarea class="question-textarea" placeholder="Digite sua resposta aqui..." oninput="saveStudentAnswer(${questao.id_questao}, this.value)">${currentAnswer}</textarea>
            `;
        }

        questionElement.innerHTML = `
            <div class="question-header">
                <span class="question-number">${index + 1}.</span>
                <h4 class="question-text">${questao.enunciado}</h4>
                <span class="question-type">${questao.tipo === 'objetiva' ? 'Objetiva' : 'Discursiva'}</span>
            </div>
            ${optionsHTML}
        `;
        examQuestionsContainer.appendChild(questionElement);

        // Add event listener for objective questions
        if (questao.tipo === 'objetiva') {
            const radioButtons = questionElement.querySelectorAll(`input[name="question_${questao.id_questao}"]`);
            radioButtons.forEach(radio => {
                radio.addEventListener('change', (event) => {
                    saveStudentAnswer(questao.id_questao, event.target.value);
                });
            });
        }
    });
}

function startExamTimer() {
    const timerElement = document.getElementById('examTimer');
    if (!timerElement) return;

    clearInterval(examTimer);
    examTimer = setInterval(() => {
        const now = new Date();
        const elapsedSeconds = Math.floor((now - examStartTime) / 1000);
        const remainingSeconds = examDuration - elapsedSeconds;

        if (remainingSeconds <= 0) {
            clearInterval(examTimer);
            timerElement.textContent = '00:00:00';
            showAlert('Tempo Esgotado', 'O tempo para a prova acabou. Suas respostas serão enviadas automaticamente.');
            finishExam(true); // Auto-submit
            return;
        }

        const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(remainingSeconds % 60).padStart(2, '0');

        timerElement.textContent = `${hours}:${minutes}:${seconds}`;
    }, 1000);
}

function saveStudentAnswer(questionId, answer) {
    studentAnswers[questionId] = answer;
    // Update currentExam respostas object to keep it in sync
    if (currentExam) {
        if (!currentExam.respostas) currentExam.respostas = {};
        currentExam.respostas[questionId] = answer;
    }
    // Only save to API when exam is finished to avoid duplicate spreadsheet entries
}

async function finishExam(autoSubmit = false) {
    showLoading();
    clearInterval(examTimer);
    isExamMode = false; // Exit exam mode

    // Exit fullscreen if still in it
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }

    // Remove security event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    // Calculate scores (simplified for now)
    let notaObjetiva = 0;
    let notaDiscursiva = 0;

    examQuestions.forEach(q => {
        const studentAns = studentAnswers[q.id_questao];
        if (q.tipo === 'objetiva' && studentAns === q.resposta_correta) {
            notaObjetiva += q.peso;
        } else if (q.tipo === 'discursiva') {
            // For discursive, professor will grade later. For now, just store the answer.
            // You might want a more sophisticated auto-grading or placeholder here.
        }
    });

    currentExam.hora_fim = new Date().toISOString();
    currentExam.respostas = studentAnswers;
    currentExam.nota_objetiva = notaObjetiva;
    currentExam.nota_discursiva = notaDiscursiva; // Placeholder
    currentExam.nota_final = notaObjetiva + notaDiscursiva; // Placeholder

    // Send final updated response to API (PUT request)
    // This is the only PUT call to avoid creating duplicate spreadsheet entries
    let result = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && (!result || !result.success)) {
        try {
            if (retryCount > 0) {
                showAlert('Salvando...', `Tentativa ${retryCount + 1}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            }
            result = await apiRequest('resposta', 'PUT', currentExam);
            if (result && result.success) {
                break;
            }
        } catch (error) {
            console.error(`Erro na tentativa ${retryCount + 1}:`, error);
        }
        retryCount++;
    }
    
    if (result && result.success) {
        // Store backup in localStorage as additional safety
        try {
            localStorage.setItem('examBackup_' + currentExam.id_resposta, JSON.stringify({
                currentExam,
                savedAt: new Date().toISOString(),
                status: 'completed'
            }));
        } catch (e) {
            console.warn('Could not save local backup:', e);
        }
        
        showAlert('Prova Finalizada', 'Suas respostas foram enviadas com sucesso!');
        showScreen('resultScreen');
        document.getElementById('resultProvaTitle').textContent = currentExam.nome + ' - ' + document.getElementById('examTitle').textContent;
        document.getElementById('resultNotaFinal').textContent = currentExam.nota_final;
    } else {
        // Save to localStorage as backup if API fails completely
        try {
            localStorage.setItem('examBackup_' + currentExam.id_resposta, JSON.stringify({
                currentExam,
                savedAt: new Date().toISOString(),
                status: 'failed_upload',
                retries: retryCount
            }));
            showAlert('Aviso', 'Não foi possível enviar suas respostas após ' + maxRetries + ' tentativas. Suas respostas foram salvas localmente. Favor contactar o professor.');
        } catch (e) {
            showAlert('Erro Crítico', 'Não foi possível salvar suas respostas. Por favor, tire uma captura de tela e contacte o professor imediatamente.');
        }
    }
    hideLoading();
}

// Exam Interaction Control
function disableExamInteractions() {
    const examScreen = document.getElementById('examScreen');
    if (examScreen) {
        const inputs = examScreen.querySelectorAll('input, textarea, button');
        inputs.forEach(input => {
            input.disabled = true;
            input.style.opacity = '0.5';
        });
        // Add overlay to prevent any interactions
        const overlay = document.createElement('div');
        overlay.id = 'fullscreenWarningOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255,0,0,0.3); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-size: 24px; font-weight: bold; color: white;
            text-align: center; backdrop-filter: blur(3px);
        `;
        overlay.innerHTML = '<div>⚠️<br>TELA CHEIA OBRIGATÓRIA<br>⚠️</div>';
        document.body.appendChild(overlay);
    }
}

function enableExamInteractions() {
    const examScreen = document.getElementById('examScreen');
    if (examScreen) {
        const inputs = examScreen.querySelectorAll('input, textarea, button');
        inputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '1';
        });
        // Remove overlay
        const overlay = document.getElementById('fullscreenWarningOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Anti-cheat and Fullscreen Functions
async function enableExamMode() {
    isExamMode = true;
    document.body.classList.add('exam-mode');
    
    // Request fullscreen with user confirmation if automatic fails
    try {
        await document.documentElement.requestFullscreen();
    } catch (err) {
        console.warn('Failed to enter fullscreen:', err);
        const userConfirm = confirm('É obrigatório estar em tela cheia para fazer a prova. Clique OK para ativar tela cheia manualmente ou Cancelar para sair.');
        if (userConfirm) {
            try {
                await document.documentElement.requestFullscreen();
            } catch (err2) {
                showAlert('Erro', 'Não foi possível ativar tela cheia. Você não poderá fazer a prova.');
                showScreen('welcomeScreen');
                return false;
            }
        } else {
            showScreen('welcomeScreen');
            return false;
        }
    }
    
    // Verify fullscreen is active
    if (!document.fullscreenElement) {
        showAlert('Erro', 'Tela cheia é obrigatória. A prova será cancelada.');
        showScreen('welcomeScreen');
        return false;
    }
    
    // Add event listeners for security
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return true;
}

function handleFullscreenChange() {
    if (!isExamMode) return; // Only act if in exam mode

    if (!document.fullscreenElement) {
        // User exited fullscreen - disable all exam interactions
        disableExamInteractions();
        exitAttempts++;
        currentExam.tentativas_de_sair = exitAttempts; // Update global counter
        // Note: Exit attempts will be saved only when exam is finished
        // Avoiding multiple PUT requests to prevent duplicate spreadsheet entries

        showAlert('Aviso', `Você saiu do modo tela cheia. Tentativas de saída: ${exitAttempts}. Todas as interações estão desabilitadas. Por favor, reative a tela cheia para continuar.`);
        // Attempt to re-enter fullscreen automatically
        try {
            document.documentElement.requestFullscreen();
        } catch (err) {
            console.warn('Failed to re-enter fullscreen automatically:', err);
        }
    } else {
        // Re-entered fullscreen - enable exam interactions
        enableExamInteractions();
    }
}

function handleVisibilityChange() {
    if (!isExamMode) return; // Only act if in exam mode

    if (document.hidden) {
        // User switched tabs or minimized window
        exitAttempts++;
        currentExam.tentativas_de_sair = exitAttempts; // Update global counter
        // Note: Exit attempts will be saved only when exam is finished
        // Avoiding multiple PUT requests to prevent duplicate spreadsheet entries

        showAlert('Aviso', `Você trocou de aba ou minimizou a janela. Tentativas de saída: ${exitAttempts}.`);
    }
}

function handleKeyDown(event) {
    if (!isExamMode) return; // Only block keys in exam mode

    // Block common cheating shortcuts
    const blockedKeys = [
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Tab', 'Alt', 'Control', 'Meta', // Basic blocking for Alt/Ctrl/Meta keys
        'PrintScreen', 'Insert', 'Home', 'End', 'PageUp', 'PageDown'
    ];

    if (blockedKeys.includes(event.key) ||
        (event.ctrlKey && event.key === 'c') || // Ctrl+C
        (event.ctrlKey && event.key === 'v') || // Ctrl+V
        (event.ctrlKey && event.key === 'x') || // Ctrl+X
        (event.ctrlKey && event.key === 'a') || // Ctrl+A
        (event.ctrlKey && event.key === 'p') || // Ctrl+P
        (event.ctrlKey && event.key === 's') || // Ctrl+S
        (event.ctrlKey && event.shiftKey && event.key === 'I') || // Ctrl+Shift+I (DevTools)
        (event.ctrlKey && event.shiftKey && event.key === 'J') || // Ctrl+Shift+J (DevTools)
        (event.ctrlKey && event.shiftKey && event.key === 'C') || // Ctrl+Shift+C (DevTools)
        (event.ctrlKey && event.shiftKey && event.key === 'V') || // Ctrl+Shift+V (Paste)
        (event.metaKey && event.key === 'c') || // Cmd+C (Mac)
        (event.metaKey && event.key === 'v') || // Cmd+V (Mac)
        (event.metaKey && event.key === 'x') || // Cmd+X (Mac)
        (event.metaKey && event.key === 'a') || // Cmd+A (Mac)
        (event.metaKey && event.key === 'p') || // Cmd+P (Mac)
        (event.metaKey && event.key === 's')    // Cmd+S (Mac)
    ) {
        event.preventDefault();
        showAlert('Aviso de Segurança', 'Esta ação é restrita durante a prova.');
    }
}

function handleContextMenu(event) {
    if (isExamMode) {
        event.preventDefault();
        showAlert('Aviso de Segurança', 'O menu de contexto está desativado durante a prova.');
    }
}

function handleBeforeUnload(event) {
    if (isExamMode) {
        event.preventDefault();
        event.returnValue = ''; // Modern browsers require this for custom message
        return ''; // For older browsers
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Assign event listeners to buttons and forms
    document.getElementById('professorLoginBtn').addEventListener('click', async () => {
        const usuario = document.getElementById('professorUser').value;
        const senha = document.getElementById('professorPass').value;
        await loginProfessor(usuario, senha);
    });

    document.getElementById('professorLogoutBtn').addEventListener('click', () => {
        currentUser = null;
        hideUserInfo();
        showScreen('welcomeScreen');
        document.getElementById('professorUser').value = '';
        document.getElementById('professorPass').value = '';
    });

    document.getElementById('showProfessorLogin').addEventListener('click', () => showScreen('professorLogin'));
    document.getElementById('showStudentAccess').addEventListener('click', () => showScreen('studentAccess'));

    // Dashboard Tabs
    document.getElementById('tabProvas').addEventListener('click', () => {
        showTab('provas');
        loadProvas();
    });
    document.getElementById('tabQuestoes').addEventListener('click', () => showTab('questoes'));
    document.getElementById('tabRespostas').addEventListener('click', () => showTab('respostas'));

    // Prova Management
    document.getElementById('newProvaBtn').addEventListener('click', () => showProvaForm());
    document.getElementById('provaFormElement').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        await saveProva(formData);
    });
    document.getElementById('cancelProvaFormBtn').addEventListener('click', hideProvaForm);

    // Questao Management
    document.getElementById('newQuestaoBtn').addEventListener('click', () => showQuestaoForm());
    document.getElementById('questaoFormElement').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        await saveQuestao(formData);
    });
    document.getElementById('cancelQuestaoFormBtn').addEventListener('click', hideQuestaoForm);
    document.getElementById('questaoTipo').addEventListener('change', (event) => toggleObjectiveOptions(event.target.value));

    // Student Access
    document.getElementById('studentProvaSelect').addEventListener('change', async (event) => {
        const provaId = event.target.value;
        if (provaId) {
            const provas = await apiRequest('prova');
            if (provas && provas.data) {
                const prova = provas.data.find(p => p.id_prova == provaId);
                if (prova) {
                    document.getElementById('studentProvaTitle').textContent = prova.titulo;
                    document.getElementById('studentProvaDetails').innerHTML = `
                        <p>Início: ${formatDateTime(prova.data_inicio)}</p>
                        <p>Fim: ${formatDateTime(prova.data_fim)}</p>
                        <p>Duração: ${prova.duracao_minutos} minutos</p>
                    `;
                }
            }
        } else {
            document.getElementById('studentProvaTitle').textContent = '';
            document.getElementById('studentProvaDetails').innerHTML = '';
        }
    });

    document.getElementById('startExamBtn').addEventListener('click', startExam);
    document.getElementById('cancelStudentAccessBtn').addEventListener('click', () => showScreen('welcomeScreen'));

    // Exam Screen
    document.getElementById('finishExamBtn').addEventListener('click', () => {
        showConfirm('Finalizar Prova', 'Tem certeza que deseja finalizar a prova? Você não poderá alterá-la depois.', (confirmed) => {
            if (confirmed) {
                finishExam();
            }
        });
    });

    // Result Screen
    document.getElementById('backToWelcomeBtn').addEventListener('click', () => showScreen('welcomeScreen'));

    // Initial load
    showScreen('welcomeScreen');
    loadStudentProvas();
});

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
    document.getElementById(`${tabName}TabContent`).classList.add('active');

    if (tabName === 'provas') {
        loadProvas();
    } else if (tabName === 'questoes') {
        const provaId = document.getElementById('provaSelectQuestoes').value;
        loadQuestoes(provaId);
    } else if (tabName === 'respostas') {
        const provaId = document.getElementById('provaSelectRespostas').value;
        loadRespostas(provaId);
    }
}

async function loadStudentProvas() {
    const provas = await apiRequest('prova');
    if (!provas || !provas.data) return;

    const studentProvaSelect = document.getElementById('studentProvaSelect');
    studentProvaSelect.innerHTML = '<option value="">Selecione uma prova</option>';

    const now = new Date();
    provas.data.forEach(prova => {
        const startDate = new Date(prova.data_inicio);
        const endDate = new Date(prova.data_fim);

        // Only show active or scheduled exams to students
        if (now >= startDate && now <= endDate) {
            const option = document.createElement('option');
            option.value = prova.id_prova;
            option.textContent = prova.titulo;
            studentProvaSelect.appendChild(option);
        }
    });
}

// Add event listener for professor dashboard tab changes
document.getElementById('provaSelectQuestoes').addEventListener('change', (event) => {
    loadQuestoes(event.target.value);
});
document.getElementById('provaSelectRespostas').addEventListener('change', (event) => {
    loadRespostas(event.target.value);
});