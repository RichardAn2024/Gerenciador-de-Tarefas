// server.js - Versão COMPLETA com TODAS as rotas
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Iniciando servidor Volmanday...');

// ============================================================
//  MIDDLEWARE
// ============================================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da raiz
app.use(express.static(__dirname));

// ============================================================
//  ROTAS DA API
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Volmanday Server rodando no Railway!',
        porta: PORT,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
//  SIMULAÇÃO DE BANCO DE DADOS (ENQUANTO NÃO TEM MYSQL)
// ============================================================

// Usuário admin padrão
const ADMIN_USER = {
    id: 1,
    nome: 'Administrador',
    email: 'admin@admin.com',
    senha: 'admin123',
    isAdmin: true
};

// Lista de usuários (simulando banco)
let usuarios = [ADMIN_USER];
let tarefas = [];
let subtarefas = [];

// ============================================================
//  ROTAS DE AUTENTICAÇÃO
// ============================================================

// Login
app.post('/api/login', (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log(`🔐 Tentativa de login: ${email}`);

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const usuario = usuarios.find(u => u.email === email);

        if (!usuario) {
            console.log(`❌ Usuário não encontrado: ${email}`);
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        if (usuario.senha !== senha) {
            console.log(`❌ Senha incorreta para: ${email}`);
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        console.log(`✅ Login bem-sucedido: ${email}`);

        res.json({
            mensagem: 'Login bem-sucedido!',
            token: 'fake-token-' + Date.now(),
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                isAdmin: usuario.isAdmin || false
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

// Cadastro
app.post('/api/cadastro', (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        console.log(`📝 Tentativa de cadastro: ${email}`);

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const usuarioExistente = usuarios.find(u => u.email === email);
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        const novoUsuario = {
            id: usuarios.length + 1,
            nome: nome,
            email: email,
            senha: senha,
            isAdmin: false
        };

        usuarios.push(novoUsuario);
        console.log(`✅ Usuário cadastrado: ${email}`);

        res.json({
            mensagem: 'Usuário cadastrado com sucesso!',
            token: 'fake-token-' + Date.now(),
            usuario: {
                id: novoUsuario.id,
                nome: novoUsuario.nome,
                email: novoUsuario.email,
                isAdmin: novoUsuario.isAdmin
            }
        });
    } catch (error) {
        console.error('❌ Erro no cadastro:', error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

// ============================================================
//  ROTAS DE TAREFAS
// ============================================================

// Listar tarefas
app.get('/api/tarefas', (req, res) => {
    try {
        res.json(tarefas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

// Criar tarefa
app.post('/api/tarefas', (req, res) => {
    try {
        const { titulo, tag, subtarefas: subtarefasList, responsavel_id, prazo } = req.body;

        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }

        const novaTarefa = {
            id: tarefas.length + 1,
            titulo: titulo,
            tag: tag || '',
            status: 'todo',
            responsavel_id: responsavel_id || null,
            prazo: prazo || null,
            data_criacao: new Date().toISOString(),
            subtarefas: subtarefasList || []
        };

        tarefas.push(novaTarefa);
        res.json({ id: novaTarefa.id, mensagem: 'Tarefa criada com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

// ============================================================
//  ROTAS DAS PÁGINAS HTML
// ============================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/assistencia.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'assistencia.html'));
});

// ============================================================
//  FALLBACK
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        erro: 'Rota não encontrada',
        mensagem: 'Verifique a URL',
        rotas_disponiveis: [
            '/',
            '/login.html',
            '/cadastro.html',
            '/admin.html',
            '/assistencia.html',
            '/api/health',
            '/api/login (POST)',
            '/api/cadastro (POST)',
            '/api/tarefas (GET/POST)'
        ]
    });
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Volmanday Server rodando na porta ${PORT}`);
    console.log(`📋 API Health: /api/health`);
    console.log(`🌐 Acesse: https://gerenciador-de-tarefas-production-4637.up.railway.app`);
    console.log(`📝 Usuário admin: admin@admin.com / admin123`);
});