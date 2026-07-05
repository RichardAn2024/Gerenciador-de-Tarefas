// server.js - Servidor principal (VERSÃO MYSQL)
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const auth = require('./auth');
require('dotenv').config();

const app = express();

// ============================================================
//  LER VARIÁVEIS DE AMBIENTE
// ============================================================

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-nao-use-em-producao';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🔧 Configurações:');
console.log(`   Porta: ${PORT}`);
console.log(`   Ambiente: ${NODE_ENV}`);
console.log(`   JWT Secret: ${JWT_SECRET ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`   Frontend URL: ${FRONTEND_URL}`);

// ============================================================
//  MIDDLEWARE CORS
// ============================================================

app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());

// ============================================================
//  LOGS (apenas em desenvolvimento)
// ============================================================

if (NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.url}`);
        next();
    });
}

// ============================================================
//  SERVIDOR DE ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================

// Serve os arquivos do frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rota para a página inicial (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Rota para login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Rota para cadastro
app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'cadastro.html'));
});

// Rota para admin
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'admin.html'));
});

// ============================================================
//  ROTAS PÚBLICAS DA API
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Servidor rodando!',
        ambiente: NODE_ENV,
        jwt_configurado: JWT_SECRET !== 'fallback-secret-nao-use-em-producao'
    });
});

// Cadastro
app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        console.log('📝 Tentando cadastrar:', { nome, email });

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const usuario = await auth.cadastrarUsuario(nome, email, senha);
        const token = auth.gerarToken(usuario.id, usuario.email, 0);

        console.log('✅ Usuário cadastrado:', usuario.email);

        res.json({
            mensagem: 'Usuário cadastrado com sucesso!',
            token: token,
            usuario: usuario
        });
    } catch (error) {
        console.error('❌ Erro no cadastro:', error.message);
        res.status(400).json({ erro: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        console.log('🔑 Tentando login:', email);

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const resultado = await auth.loginUsuario(email, senha);

        console.log('✅ Login realizado:', email);

        res.json(resultado);
    } catch (error) {
        console.error('❌ Erro no login:', error.message);
        res.status(401).json({ erro: error.message });
    }
});

// ============================================================
//  ROTA PARA LISTAR USUÁRIOS (responsáveis) - VERSÃO MYSQL
// ============================================================

app.get('/api/usuarios', auth.autenticar, async (req, res) => {
    try {
        console.log('👥 Listando usuários');

        const [rows] = await db.query('SELECT id, nome, email FROM usuarios ORDER BY nome');

        console.log(`✅ ${rows.length} usuários encontrados`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        res.status(500).json({ erro: 'Erro ao buscar usuários' });
    }
});

// ============================================================
//  ROTAS PROTEGIDAS (TAREFAS) - VERSÃO MYSQL
// ============================================================

// Buscar TODAS as tarefas (todos os usuários veem todas as tarefas)
app.get('/api/tarefas', auth.autenticar, async (req, res) => {
    try {
        console.log(`📋 Buscando todas as tarefas (compartilhadas)`);

        const [tarefas] = await db.query(`
            SELECT t.*, 
                   u.nome as responsavel_nome, 
                   u.email as responsavel_email,
                   criador.nome as criador_nome,
                   criador.id as criador_id
            FROM tarefas t
            LEFT JOIN usuarios u ON t.responsavel_id = u.id
            LEFT JOIN usuarios criador ON t.usuario_id = criador.id
            ORDER BY t.data_criacao DESC
        `);

        console.log(`✅ ${tarefas.length} tarefas encontradas`);

        // Buscar subtarefas para cada tarefa
        for (let tarefa of tarefas) {
            const [subtarefas] = await db.query(
                'SELECT * FROM subtarefas WHERE tarefa_id = ?',
                [tarefa.id]
            );
            tarefa.subtarefas = subtarefas || [];
        }

        res.json(tarefas);
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas:', error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

// Criar nova tarefa (visível para todos)
app.post('/api/tarefas', auth.autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { titulo, tag, subtarefas, responsavel_id } = req.body;

        console.log(`📝 Criando tarefa para usuário ${usuarioId}:`, titulo);

        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }

        const [result] = await db.query(
            'INSERT INTO tarefas (usuario_id, titulo, tag, status, responsavel_id) VALUES (?, ?, ?, ?, ?)',
            [usuarioId, titulo, tag || '', 'todo', responsavel_id || null]
        );

        const tarefaId = result.insertId;
        console.log(`✅ Tarefa criada com ID: ${tarefaId}`);

        // Inserir subtarefas
        if (subtarefas && subtarefas.length > 0) {
            for (let sub of subtarefas) {
                await db.query(
                    'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                    [tarefaId, sub.texto, sub.concluida || 0]
                );
            }
        }

        res.json({
            id: tarefaId,
            mensagem: 'Tarefa criada com sucesso!'
        });
    } catch (error) {
        console.error('❌ Erro ao criar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

// Atualizar tarefa (qualquer usuário pode editar qualquer tarefa)
app.put('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { titulo, tag, subtarefas, responsavel_id } = req.body;

        console.log(`✏️ Atualizando tarefa ${tarefaId}`);

        await db.query(
            'UPDATE tarefas SET titulo = ?, tag = ?, responsavel_id = ? WHERE id = ?',
            [titulo, tag || '', responsavel_id || null, tarefaId]
        );

        // Deletar subtarefas antigas
        await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [tarefaId]);

        // Inserir novas subtarefas
        if (subtarefas && subtarefas.length > 0) {
            for (let sub of subtarefas) {
                await db.query(
                    'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                    [tarefaId, sub.texto, sub.concluida || 0]
                );
            }
        }

        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
    }
});

// Atualizar status da tarefa (qualquer usuário pode alterar status)
app.patch('/api/tarefas/:id/status', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { status } = req.body;

        console.log(`🔄 Atualizando status da tarefa ${tarefaId} para ${status}`);

        await db.query(
            'UPDATE tarefas SET status = ? WHERE id = ?',
            [status, tarefaId]
        );

        console.log(`✅ Status atualizado para ${status}`);
        res.json({ mensagem: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
});

// Alternar subtarefa (qualquer usuário pode alternar)
app.patch('/api/subtarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const subtarefaId = req.params.id;
        const { concluida } = req.body;

        console.log(`🔄 Alternando subtarefa ${subtarefaId} para ${concluida ? 'concluída' : 'pendente'}`);

        await db.query(
            'UPDATE subtarefas SET concluida = ? WHERE id = ?',
            [concluida ? 1 : 0, subtarefaId]
        );

        console.log('✅ Subtarefa atualizada');
        res.json({ mensagem: 'Subtarefa atualizada!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar subtarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
    }
});

// Deletar tarefa (qualquer usuário pode deletar qualquer tarefa)
app.delete('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;

        console.log(`🗑️ Deletando tarefa ${tarefaId}`);

        await db.query('DELETE FROM tarefas WHERE id = ?', [tarefaId]);

        console.log('✅ Tarefa deletada');
        res.json({ mensagem: 'Tarefa deletada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao deletar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

// ============================================================
//  ROTAS DE ADMIN
// ============================================================

app.get('/api/admin/usuarios', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const usuarios = await auth.listarUsuarios();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

app.delete('/api/admin/usuarios/:id', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await auth.deletarUsuario(id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.get('/api/admin/estatisticas', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const stats = await auth.obterEstatisticas();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ============================================================
//  INICIAR SERVIDOR - VERSÃO DIGITALOCEAN
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API disponível em http://localhost:${PORT}/api/health`);
    console.log(`🌐 Ambiente: ${NODE_ENV}`);
    console.log(`🔒 JWT Secret: ${JWT_SECRET !== 'fallback-secret-nao-use-em-producao' ? '✅ Configurada' : '⚠️ Usando padrão (NÃO RECOMENDADO)'}`);
    console.log(`📂 Servindo frontend de: ${path.join(__dirname, '../frontend')}`);
});

console.log('✅ Servidor iniciado com sucesso!');