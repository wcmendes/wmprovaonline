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
    document.getElementById(\'alertTitle\').textContent = title;
    document.getElementById(\'alertMessage\').textContent = message;
    document.getElementById(\'alertModal\').style.display = \'flex\';
    // Ensure the button correctly closes the alert
    document.getElementById(\'alertOkBtn\').onclick = () => { hideAlert(); };
}

function hideAlert() {
    document.getElementById('alertModal').style.display = 'none';
}

function showConfirm(title, message, callback) {
    document.getElementById(\'confirmTitle\').textContent = title;
    document.getElementById(\'confirmMessage\').textContent = message;
    document.getElementById(\'confirmModal\').style.display = \'flex\';
    
    document.getElementById(\'confirmYesBtn\').onclick = () => {
        hideConfirm();
        callback(true);
    };
    
    document.getElementById(\'confirmNoBtn\').onclick = () => {
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
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    return cpf.length === 11;
}

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none'; // Ensure it's hidden
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'flex'; // Or 'block' depending on your CSS
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

// Quasync function loadRespostas(provaId) {
    if (!provaId) {
        document.getElementById(\'respostasList\').innerHTML = \'\';
        return;
    }
    
    const respostas = await apiRequest(\'resposta\');
    if (!respostas || !respostas.data) {
        document.getElementById(\'respostasList\').innerHTML = \'<p>Erro ao carregar respostas.</p>\';
        return;
    }
    
    const provaRespostas = respostas.data.filter(r => r.id_prova == provaId);
    const respostasList = document.getElementById(\'respostasList\');
    respostasList.innerHTML = \'\';
    
    if (provaRespostas.length === 0) {
        respostasList.innerHTML = \'<p>Nenhuma resposta encontrada para esta prova.</p>\';
        return;
    }

    // Create table header
    let tableHtml = `
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

    provaRespostas.forEach(resposta => {
        let parsedRespostas = \'\';
        try {
            parsedRespostas = resposta.respostas ? JSON.stringify(JSON.parse(resposta.respostas), null, 2) : \'\'{}\'\';
        } catch (e) {
            parsedRespostas = resposta.respostas || \'Inválido\';
        }

        tableHtml += `
            <tr>
                <td>${resposta.id_resposta || \'\'}</td>
                <td>${resposta.nome || \'\'}</td>
                <td>${resposta.email || \'\'}</td>
                <td>${formatCPF(resposta.cpf || \'\')}</td>
                <td>${resposta.ip || \'\'}</td>
                <td>${formatDateTime(resposta.hora_login)}</td>
                <td>${formatDateTime(resposta.hora_fim)}</td>
                <td><pre>${parsedRespostas}</pre></td>
                <td>${resposta.nota_objetiva || \'\'}</td>
                <td>${resposta.nota_discursiva || \'\'}</td>
                <td>${resposta.nota_final || \'\'}</td>
                <td>${resposta.tentativas_de_sair || 0}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;
    respostasList.innerHTML = tableHtml;
}

// Helper function to create a card for each response (if needed, currently using table)
function createRespostaCard(resposta) {
    const card = document.createElement(\'div\');
    card.className = \'item-card\';
    card.innerHTML = `
        <div class="item-header">
            <h4 class="item-title">Resposta de ${resposta.nome || \'Aluno Desconhecido\'}</h4>
            <div class="item-actions">
                <span>CPF: ${formatCPF(resposta.cpf || \'\')}</span>
            </div>
        </div>
        <div class="item-details">
            <div class="item-detail">
                <strong>Login:</strong>
                <span>${formatDateTime(resposta.hora_login)}</span>
            </div>
            <div class="item-detail">
                <strong>Fim:</strong>
                <span>${formatDateTime(resposta.hora_fim)}</span>
            </div>
            <div class="item-detail">
                <strong>IP:</strong>
                <span>${resposta.ip || \'\'}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Objetiva:</strong>
                <span>${resposta.nota_objetiva || \'\'}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Discursiva:</strong>
                <span>${resposta.nota_discursiva || \'\'}</span>
            </div>
            <div class="item-detail">
                <strong>Nota Final:</strong>
                <span>${resposta.nota_final || \'\'}</span>
            </div>
            <div class="item-detail">
                <strong>Tentativas de Sair:</strong>
                <span>${resposta.tentativas_de_sair || 0}</span>
            </div>
            <div class="item-detail full-width">
                <strong>Respostas:</strong>
                <pre>${resposta.respostas ? JSON.stringify(JSON.parse(resposta.respostas), null, 2) : \'\'{}\'\'}</pre>
            </div>
        </div>
    `;
    return card;
}createQuestaoCard(questao) {
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
        
        // Show/hide objective options based on question type
        if (questao.tipo === 'objetiva') {
            document.getElementById('objectiveOptions').style.display = 'block';
            document.getElementById('correctAnswer').style.display = 'block';
        } else {
            document.getElementById('objectiveOptions').style.display = 'none';
            document.getElementById('correctAnswer').style.display = 'none';
        }
    } else {
        title.textContent = 'Nova Questão';
        form.reset();
        form.id_questao.value = '';
        form.id_prova.value = provaId;
        document.getElementById('objectiveOptions').style.display = 'none';
        document.getElementById('correctAnswer').style.display = 'none';
    }
    
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

// Student Exam Functions
async function startExam(studentData) {
    try {
        const activeExam = await checkActiveExam();
        if (!activeExam) {
            showAlert(\'Erro\', \'Não há prova ativa no momento.\');
            return;
        }

        const respostas = await apiRequest("resposta");
        let existingResponse = null;

        if (respostas && respostas.data) {
            existingResponse = respostas.data.find(r => 
                r.id_prova == activeExam.id_prova && r.cpf === studentData.cpf
            );
        }

        if (existingResponse && existingResponse.hora_fim) {
            showAlert("Erro", "Você já finalizou esta prova.");
            return;
        }

        currentExam = activeExam;

        if (existingResponse) {
            // Resume exam
            currentExam.id_resposta = existingResponse.id_resposta;
            studentAnswers = JSON.parse(existingResponse.respostas || "{}");
            examStartTime = new Date(existingResponse.hora_login);
            await loadExamQuestions();
            showExamScreen();
        } else {
            // Create new response record
            const newResponseData = {
                id_resposta: Date.now(),
                id_prova: activeExam.id_prova,
                nome: studentData.nome,
                email: studentData.email,
                cpf: studentData.cpf,
                ip: await getUserIP(),
                hora_login: new Date().toISOString(),
                respostas: "{}",
                tentativas_de_sair: 0
            };

            const result = await apiRequest("resposta", "POST", newResponseData);
            if (result && result.success) {
                currentExam.id_resposta = newResponseData.id_resposta;
                examStartTime = new Date();
                studentAnswers = {};
                await loadExamQuestions();
                showExamScreen();
            } else {
                showAlert("Erro", "Erro ao iniciar prova.");
            }
        }
    } catch (error) {
        console.error("Erro em startExam:", error);
        showAlert("Erro Crítico", "Ocorreu um erro inesperado ao iniciar a prova. Tente novamente.");
    }
}

async function getUserIP() {
    return new Promise((resolve) => {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => resolve(data.ip))
            .catch(() => resolve('unknown'));
    });
}

async function checkActiveExam() {
    const provas = await apiRequest('prova');
    if (!provas || !provas.data) return null;

    const now = new Date();
    const active = provas.data.find(prova => {
        const startDate = new Date(prova.data_inicio);
        const endDate = new Date(prova.data_fim);
        return now >= startDate && now <= endDate;
    });
    return active;
}

function loadExamQuestions() {
    const examQuestionsList = document.getElementById('examQuestionsList');
    examQuestionsList.innerHTML = '';

    examQuestions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'exam-question-card';
        questionElement.innerHTML = `
            <h4>Questão ${index + 1} (${question.tipo === 'objetiva' ? 'Objetiva' : 'Discursiva'}) - Peso: ${question.peso}</h4>
            <p>${question.enunciado}</p>
            ${question.tipo === 'objetiva' ? `
                <div class="options">
                    <label><input type="radio" name="question_${question.id_questao}" value="A"> A) ${question.opcao_a}</label>
                    <label><input type="radio" name="question_${question.id_questao}" value="B"> B) ${question.opcao_b}</label>
                    <label><input type="radio" name="question_${question.id_questao}" value="C"> C) ${question.opcao_c}</label>
                    <label><input type="radio" name="question_${question.id_questao}" value="D"> D) ${question.opcao_d}</label>
                    <label><input type="radio" name="question_${question.id_questao}" value="E"> E) ${question.opcao_e}</label>
                </div>
            ` : `
                <textarea name="question_${question.id_questao}" rows="5" placeholder="Sua resposta..."></textarea>
            `}
        `;
        examQuestionsList.appendChild(questionElement);

        // Restore previous answer if exists
        if (studentAnswers[question.id_questao]) {
            if (question.tipo === 'objetiva') {
                const radio = questionElement.querySelector(`input[value="${studentAnswers[question.id_questao]}"]`);
                if (radio) radio.checked = true;
            } else {
                const textarea = questionElement.querySelector('textarea');
                if (textarea) textarea.value = studentAnswers[question.id_questao];
            }
        }

        // Add event listener to save answer on change
        questionElement.addEventListener('change', (event) => {
            const target = event.target;
            const questionId = question.id_questao;
            if (target.type === 'radio' || target.tagName === 'TEXTAREA') {
                studentAnswers[questionId] = target.value;
            }
        });
    });
}

function updateExamTimerDisplay() {
    const timerElement = document.getElementById('timer');
    const now = Date.now();
    const elapsed = now - examStartTime.getTime();
    const remaining = examDuration * 60 * 1000 - elapsed;

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
        id_resposta: currentExam.id_resposta, // Use the stored id_resposta
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

async function enableExamMode() {
    isExamMode = true;
    document.body.classList.add('exam-mode');
    
    // Request fullscreen
    try {
        await document.documentElement.requestFullscreen();
    } catch (err) {
        console.warn("Failed to enter fullscreen:", err);
        showAlert("Aviso", "Não foi possível entrar em modo tela cheia automaticamente. Por favor, ative manualmente para continuar a prova.");
    }
    
    // Add event listeners for security
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function disableExamMode() {
    isExamMode = false;
    document.body.classList.remove('exam-mode');
    
    // Exit fullscreen
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
    window.removeEventListener('beforeunload', handleBeforeUnload);
}

function handleVisibilityChange() {
    if (isExamMode && document.hidden) {
        exitAttempts++;
        showAlert('Aviso', 'Tentativa de sair da janela registrada. Mantenha-se na prova.');
    }
}

function handleKeyDown(event) {
    if (isExamMode) {
        // Block common cheating attempts
        if (event.key === 'Tab' || 
            (event.ctrlKey && event.key === 'c') || 
            (event.ctrlKey && event.key === 'v') || 
            (event.ctrlKey && event.key === 'a') || 
            (event.ctrlKey && event.key === 'x') ||
            (event.ctrlKey && event.shiftKey && event.key === 'V') // Block CTRL+SHIFT+V
        ) {
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

function handleFullscreenChange() {
    if (!document.fullscreenElement && isExamMode) {
        exitAttempts++;
        showAlert("Aviso", "Você saiu do modo tela cheia. Evento registrado pelo WM Prova Online. Tentando retornar ao modo tela cheia...");
        try {
            document.documentElement.requestFullscreen();
        } catch (err) {
            console.warn("Failed to re-enter fullscreen:", err);
        }
    }
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
    
    // Questoes tab
    document.getElementById('provaSelectQuestoes').addEventListener('change', (e) => {
        loadQuestoes(e.target.value);
    });
    
    document.getElementById('addQuestaoBtn').addEventListener('click', () => {
        showQuestaoForm();
    });
    
    document.getElementById('cancelQuestaoForm').addEventListener('click', () => {
        hideQuestaoForm();
    });
    
    document.getElementById('questaoFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await saveQuestao(formData);
    });
    
    document.getElementById('questaoTipo').addEventListener('change', (e) => {
        if (e.target.value === 'objetiva') {
            document.getElementById('objectiveOptions').style.display = 'block';
            document.getElementById('correctAnswer').style.display = 'block';
        } else {
            document.getElementById('objectiveOptions').style.display = 'none';
            document.getElementById('correctAnswer').style.display = 'none';
        }
    });

    // Respostas tab
    document.getElementById('provaSelectRespostas').addEventListener('change', (e) => {
        loadRespostas(e.target.value);
    });

    // Initial screen setup
    showScreen('homeScreen');
});

// Initial setup (This line is redundant if called inside DOMContentLoaded)
// showScreen('homeScreen');


