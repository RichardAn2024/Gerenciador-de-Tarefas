// server.js - Servidor para Railway
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const auth = require('./auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ============================================================
//  CAMINHO DO FRONTEND
// ============================================================

// Railway usa o diretório atual como base
const frontendPath = path.join(__dirname, '../frontend');

// Se não encontrar ../frontend, tenta o diretório atual
let staticPath = frontendPath;
if (!fs.existsSync(frontendPath)) {
    staticPath = path.join(__dirname, '../');
    console.log(`📂 Frontend não encontrado em ${frontendPath}, tentando ${staticPath}`);
}

// Verifica se existe index.html no caminho
if (fs.existsSync(path.join(staticPath, 'index.html'))) {
    console.log(`📂 Servindo frontend de: ${staticPath}`);
    app.use(express.static(staticPath));
} else {
    console.log(`⚠️ Frontend não encontrado. Servindo apenas API.`);
}

// ============================================================
//  ROTAS DA API
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Volmanday Server rodando no Railway!',
        ambiente: process.env.NODE_ENV || 'development'
    });
});

// CADASTRO
app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
        }
        const usuario = await auth.cadastrarUsuario(nome, email, senha);
        const token = auth.gerarToken(usuario.id, usuario.email, 0);
        res.json({ mensagem: 'Usuário cadastrado com sucesso!', token, usuario });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }
        const resultado = await auth.loginUsuario(email, senha);
        res.json(resultado);
    } catch (error) {
        res.status(401).json({ erro: error.message });
    }
});

// USUÁRIOS
app.get('/api/usuarios', auth.autenticar, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nome, email FROM usuarios ORDER BY nome');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar usuários' });
    }
});

// TAREFAS - LISTAR (EXCLUI ASSISTÊNCIA)
app.get('/api/tarefas', auth.autenticar, async (req, res) => {
    try {
        const [tarefas] = await db.query(`
            SELECT t.*, 
                   u.nome as responsavel_nome, 
                   u.email as responsavel_email,
                   criador.nome as criador_nome,
                   criador.id as criador_id
            FROM tarefas t
            LEFT JOIN usuarios u ON t.responsavel_id = u.id
            LEFT JOIN usuarios criador ON t.usuario_id = criador.id
            WHERE t.tag != 'assistencia' OR t.tag IS NULL
            ORDER BY t.data_criacao DESC
        `);
        for (let tarefa of tarefas) {
            const [subtarefas] = await db.query('SELECT * FROM subtarefas WHERE tarefa_id = ?', [tarefa.id]);
            tarefa.subtarefas = subtarefas || [];
        }
        res.json(tarefas);
    } catch (error) {
        console.error('Erro ao buscar tarefas:', error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

// TAREFAS - ASSISTÊNCIA
app.get('/api/tarefas/assistencia', auth.autenticar, async (req, res) => {
    try {
        const [tarefas] = await db.query(`
            SELECT t.*, 
                   u.nome as responsavel_nome, 
                   u.email as responsavel_email,
                   criador.nome as criador_nome,
                   criador.id as criador_id
            FROM tarefas t
            LEFT JOIN usuarios u ON t.responsavel_id = u.id
            LEFT JOIN usuarios criador ON t.usuario_id = criador.id
            WHERE t.tag = 'assistencia'
            ORDER BY t.data_criacao DESC
        `);
        for (let tarefa of tarefas) {
            const [subtarefas] = await db.query('SELECT * FROM subtarefas WHERE tarefa_id = ?', [tarefa.id]);
            tarefa.subtarefas = subtarefas || [];
        }
        res.json(tarefas);
    } catch (error) {
        console.error('Erro ao buscar tarefas de assistência:', error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas de assistência' });
    }
});

// TAREFAS - CRIAR
app.post('/api/tarefas', auth.autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { titulo, tag, subtarefas, responsavel_id, prazo } = req.body;
        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }
        const [result] = await db.query(
            'INSERT INTO tarefas (usuario_id, titulo, tag, status, responsavel_id, prazo) VALUES (?, ?, ?, ?, ?, ?)',
            [usuarioId, titulo, tag || '', 'todo', responsavel_id || null, prazo || null]
        );
        const tarefaId = result.insertId;
        if (subtarefas && subtarefas.length > 0) {
            for (let sub of subtarefas) {
                await db.query('INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                    [tarefaId, sub.texto, sub.concluida || 0]);
            }
        }
        res.json({ id: tarefaId, mensagem: 'Tarefa criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

// TAREFAS - ATUALIZAR
app.put('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { titulo, tag, subtarefas, responsavel_id, prazo } = req.body;
        await db.query('UPDATE tarefas SET titulo = ?, tag = ?, responsavel_id = ?, prazo = ? WHERE id = ?',
            [titulo, tag || '', responsavel_id || null, prazo || null, tarefaId]);
        await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [tarefaId]);
        if (subtarefas && subtarefas.length > 0) {
            for (let sub of subtarefas) {
                await db.query('INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                    [tarefaId, sub.texto, sub.concluida || 0]);
            }
        }
        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
    }
});

// TAREFAS - STATUS
app.patch('/api/tarefas/:id/status', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { status } = req.body;
        await db.query('UPDATE tarefas SET status = ? WHERE id = ?', [status, tarefaId]);
        res.json({ mensagem: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
});

// SUBTAREFAS
app.patch('/api/subtarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const subtarefaId = req.params.id;
        const { concluida } = req.body;
        await db.query('UPDATE subtarefas SET concluida = ? WHERE id = ?', [concluida ? 1 : 0, subtarefaId]);
        res.json({ mensagem: 'Subtarefa atualizada!' });
    } catch (error) {
        console.error('Erro ao atualizar subtarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
    }
});

// TAREFAS - DELETAR
app.delete('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        await db.query('DELETE FROM tarefas WHERE id = ?', [tarefaId]);
        res.json({ mensagem: 'Tarefa deletada com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

// ADMIN - LISTAR USUÁRIOS
app.get('/api/admin/usuarios', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const usuarios = await auth.listarUsuarios();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ADMIN - DELETAR USUÁRIO
app.delete('/api/admin/usuarios/:id', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await auth.deletarUsuario(id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// ADMIN - ESTATÍSTICAS
app.get('/api/admin/estatisticas', auth.autenticar, auth.adminApenas, async (req, res) => {
    try {
        const stats = await auth.obterEstatisticas();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ============================================================
//  ROTAS DO FRONTEND
// ============================================================

// Servir arquivos estáticos do frontend
if (fs.existsSync(staticPath)) {
    app.get('/', (req, res) => {
        const indexPath = path.join(staticPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.json({ mensagem: 'API Volmanday rodando!' });
        }
    });

    app.get('/login.html', (req, res) => {
        res.sendFile(path.join(staticPath, 'login.html'));
    });

    app.get('/cadastro.html', (req, res) => {
        res.sendFile(path.join(staticPath, 'cadastro.html'));
    });

    app.get('/admin.html', (req, res) => {
        res.sendFile(path.join(staticPath, 'admin.html'));
    });

    app.get('/assistencia.html', (req, res) => {
        res.sendFile(path.join(staticPath, 'assistencia.html'));
    });
}

// FALLBACK
app.get('*', (req, res) => {
    if (fs.existsSync(staticPath) && fs.existsSync(path.join(staticPath, 'index.html'))) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        res.json({
            mensagem: 'Volmanday API',
            rotas: '/api/health, /api/login, /api/cadastro, /api/tarefas'
        });
    }
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Volmanday Server rodando na porta ${PORT}`);
    console.log(`📋 API Health: /api/health`);
});

process.on('uncaughtException', (err) => console.error('❌ Erro não tratado:', err));
process.on('unhandledRejection', (err) => console.error('❌ Rejeição não tratada:', err));