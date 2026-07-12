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
//  SIMULAÇÃO DE BANCO DE DADOS
// ============================================================

const ADMIN_USER = {
    id: 1,
    nome: 'Administrador',
    email: 'admin@admin.com',
    senha: 'admin123',
    isAdmin: true
};

let usuarios = [ADMIN_USER];
let tarefas = [];
let subtarefas = [];

// ============================================================
//  ROTAS DE AUTENTICAÇÃO
// ============================================================

app.post('/api/login', (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log(`🔐 Tentativa de login: ${email}`);

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const usuario = usuarios.find(u => u.email === email);

        if (!usuario) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        if (usuario.senha !== senha) {
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

app.post('/api/cadastro', (req, res) => {
    try {
        const { nome, email, senha } = req.body;

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

app.get('/api/tarefas', (req, res) => {
    try {
        res.json(tarefas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

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

app.delete('/api/tarefas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = tarefas.findIndex(t => t.id === id);
        if (index === -1) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }
        tarefas.splice(index, 1);
        res.json({ mensagem: 'Tarefa deletada com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

app.patch('/api/tarefas/:id/status', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const tarefa = tarefas.find(t => t.id === id);
        if (!tarefa) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }
        tarefa.status = status;
        res.json({ mensagem: 'Status atualizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
});

app.put('/api/tarefas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { titulo, tag, subtarefas: subtarefasList, responsavel_id, prazo } = req.body;
        const tarefa = tarefas.find(t => t.id === id);
        if (!tarefa) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }
        tarefa.titulo = titulo || tarefa.titulo;
        tarefa.tag = tag || tarefa.tag;
        tarefa.responsavel_id = responsavel_id || tarefa.responsavel_id;
        tarefa.prazo = prazo || tarefa.prazo;
        tarefa.subtarefas = subtarefasList || tarefa.subtarefas;
        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
    }
});

app.patch('/api/subtarefas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { concluida } = req.body;
        // Procurar a subtarefa em todas as tarefas
        for (const tarefa of tarefas) {
            if (tarefa.subtarefas) {
                const subtarefa = tarefa.subtarefas.find(s => s.id === id);
                if (subtarefa) {
                    subtarefa.concluida = concluida ? 1 : 0;
                    return res.json({ mensagem: 'Subtarefa atualizada!' });
                }
            }
        }
        res.status(404).json({ erro: 'Subtarefa não encontrada' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
    }
});

// ============================================================
//  ROTAS DE ADMIN
// ============================================================

app.get('/api/admin/usuarios', (req, res) => {
    try {
        const usuariosList = usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            is_admin: u.isAdmin ? 1 : 0,
            total_tarefas: tarefas.filter(t => t.responsavel_id === u.id || t.usuario_id === u.id).length,
            criado_em: new Date().toISOString()
        }));
        res.json(usuariosList);
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro ao carregar usuários' });
    }
});

app.delete('/api/admin/usuarios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const usuario = usuarios.find(u => u.id === id);
        if (usuario && usuario.isAdmin) {
            return res.status(403).json({ erro: 'Não é possível deletar o administrador' });
        }
        const index = usuarios.findIndex(u => u.id === id);
        if (index === -1) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        usuarios.splice(index, 1);
        res.json({ mensagem: 'Usuário deletado com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }
});

app.get('/api/admin/estatisticas', (req, res) => {
    try {
        res.json({
            total_usuarios: usuarios.length,
            total_tarefas: tarefas.length,
            total_subtarefas: 0
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao carregar estatísticas' });
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
//  HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Volmanday Server rodando no Railway!',
        porta: PORT,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
//  FALLBACK
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        erro: 'Rota não encontrada',
        mensagem: 'Verifique a URL'
    });
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Volmanday Server rodando na porta ${PORT}`);
    console.log(`📋 API Health: /api/health`);
    console.log(`👤 Admin: admin@admin.com / admin123`);
});