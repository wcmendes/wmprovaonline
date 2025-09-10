# WM Prova Online

Sistema de provas online para professores e alunos, desenvolvido para funcionar no GitHub Pages.

## 📋 Descrição

O WM Prova Online é um sistema completo de provas online que permite:

- **Para Professores:**
  - Login seguro
  - Criação e gerenciamento de provas
  - Cadastro de questões objetivas e discursivas
  - Visualização de respostas dos alunos
  - Correção automática de questões objetivas
  - Lançamento manual de notas discursivas

- **Para Alunos:**
  - Acesso com dados pessoais (nome, email, CPF)
  - Realização de provas em modo tela cheia
  - Timer com contagem regressiva
  - Bloqueio de cópia/cola e atalhos
  - Registro de tentativas de saída
  - Auto-salvamento de respostas

## 🚀 Funcionalidades

### Segurança
- ✅ Modo tela cheia obrigatório durante a prova
- ✅ Bloqueio de copiar/colar (Ctrl+C, Ctrl+V)
- ✅ Bloqueio de atalhos do desenvolvedor (F12, Ctrl+U, Ctrl+Shift+I)
- ✅ Bloqueio do menu de contexto (clique direito)
- ✅ Registro de tentativas de sair da janela
- ✅ Timer com finalização automática
- ✅ Auto-salvamento de respostas

### Interface
- ✅ Design moderno e responsivo
- ✅ Navegação intuitiva
- ✅ Feedback visual em tempo real
- ✅ Indicador de progresso da prova
- ✅ Alertas e confirmações

### Integração
- ✅ API do Google Sheets para armazenamento
- ✅ Validação de dados em tempo real
- ✅ Cálculo automático de notas
- ✅ Formatação automática de CPF

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Google Sheets API
- **Hospedagem:** GitHub Pages
- **Design:** CSS Grid, Flexbox, Gradientes

## 📦 Estrutura do Projeto

```
WM_Prova_Online/
├── index.html          # Página principal
├── style.css           # Estilos CSS
├── script.js           # Lógica JavaScript
├── README.md           # Documentação
└── test_results.md     # Resultados dos testes
```

### Estrutura das Tabelas

#### Tabela `usuario`
- `usuario` - Nome de usuário do professor
- `senha` - Senha do professor

#### Tabela `prova`
- `id_prova` - ID único da prova
- `titulo` - Título da prova
- `data_inicio` - Data/hora de início (AAAA-MM-DD HH:MM)
- `data_fim` - Data/hora de fim (AAAA-MM-DD HH:MM)
- `duracao_minutos` - Duração em minutos
- `nota_maxima` - Nota máxima da prova

#### Tabela `questao`
- `id_questao` - ID único da questão
- `id_prova` - ID da prova relacionada
- `tipo` - Tipo da questão (objetiva/discursiva)
- `enunciado` - Texto da questão
- `opcao_a`, `opcao_b`, `opcao_c`, `opcao_d`, `opcao_e` - Opções (apenas objetivas)
- `resposta_correta` - Resposta correta (apenas objetivas)
- `peso` - Peso da questão na nota final

#### Tabela `resposta`
- `id_resposta` - ID único da resposta
- `id_prova` - ID da prova
- `nome` - Nome do aluno
- `email` - Email do aluno
- `cpf` - CPF do aluno
- `ip` - IP do aluno
- `hora_login` - Horário de início da prova
- `hora_fim` - Horário de finalização
- `respostas` - JSON com todas as respostas
- `nota_objetiva` - Nota das questões objetivas (calculada automaticamente)
- `nota_discursiva` - Nota das questões discursivas (lançada pelo professor)
- `nota_final` - Nota final (objetiva + discursiva)
- `tentativas_de_sair` - Número de tentativas de sair da janela

## 🚀 Deploy no GitHub Pages

1. Faça upload dos arquivos para um repositório GitHub
2. Vá em Settings > Pages
3. Selecione a branch main como source
4. O sistema estará disponível em `https://wcmendes.github.io/wmprovaonline`

## 📱 Compatibilidade

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS Safari, Android Chrome)
- ✅ Tablet (iPad, Android tablets)

## 🔒 Requisitos de Segurança Atendidos

1. **Login único do professor** - Implementado
2. **Modo tela cheia obrigatório** - Implementado
3. **Bloqueio de cópia/cola** - Implementado
4. **Registro de tentativas de saída** - Implementado
5. **Timer com finalização automática** - Implementado
6. **Validação de dados** - Implementado
7. **Auto-salvamento** - Implementado

## 📄 Licença

© 2025 William Corrêa Mendes

É permitida a reprodução, adaptação e distribuição, desde que seja dado o devido crédito ao autor.

## 🆘 Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com o desenvolvedor.

