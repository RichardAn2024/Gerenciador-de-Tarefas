// server.js - Servidor principal (VERSÃO HOSTINGER - MANUAL)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const auth = require('./auth');
require('dotenv').config();

const app = express();

// ============================================================
//  LER VARIÁVEIS DE AMBIENTE
// ============================================================

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://richardangelo.net';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-nao-use-em-producao';
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🔧 Configurações:');
console.log(`   Porta: ${PORT}`);
console.log(`   Ambiente: ${NODE_ENV}`);
console.log(`   JWT Secret: ${JWT_SECRET ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`   Frontend URL: ${FRONTEND_URL}`);

// ============================================================
//  MIDDLEWARE
// ============================================================

app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());

// ============================================================
//  CAMINHO DO FRONTEND - UPLOAD MANUAL
// ============================================================

// 🔥 CAMINHO CORRETO para upload manual via FileZilla
// Os arquivos do frontend estão em: /domains/richardangelo.net/public_html/
// Mas o Node.js está rodando em: /domains/richardangelo.net/nodejs/

// Opção 1: Frontend dentro do nodejs (se você colocou lá)
const frontendPath1 = path.join(__dirname, 'frontend');

// Opção 2: Frontend no public_html (recomendado)
const frontendPath2 = path.join(__dirname, '../public_html');

// Opção 3: Caminho absoluto
const frontendPath3 = '/home/u332502777/domains/richardangelo.net/public_html';

// Escolher o primeiro que existir
let frontendPath = null;
const possiveisCaminhos = [frontendPath1, frontendPath2, frontendPath3];

for (const caminho of possiveisCaminhos) {
    try {
        const indexFile = path.join(caminho, 'index.html');
        if (fs.existsSync(indexFile)) {
            frontendPath = caminho;
            console.log(`✅ Frontend encontrado em: ${caminho}`);
            break;
        }
    } catch (err) {
        // Ignorar
    }
}

// Se não encontrou, usar fallback
if (!frontendPath) {
    frontendPath = frontendPath2;
    console.log(`⚠️ Usando fallback: ${frontendPath}`);
}

console.log(`📂 Servindo frontend de: ${frontendPath}`);

// ============================================================
//  SERVIDOR DE ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send(`
            <h1>404 - Página não encontrada</h1>
            <p>index.html não encontrado em: ${frontendPath}</p>
            <p><a href="/api/health">Verificar status</a></p>
        `);
    }
});

app.get('/login.html', (req, res) => {
    const file = path.join(frontendPath, 'login.html');
    if (fs.existsSync(file)) res.sendFile(file);
    else res.status(404).send('login.html não encontrado');
});

app.get('/cadastro.html', (req, res) => {
    const file = path.join(frontendPath, 'cadastro.html');
    if (fs.existsSync(file)) res.sendFile(file);
    else res.status(404).send('cadastro.html não encontrado');
});

app.get('/admin.html', (req, res) => {
    const file = path.join(frontendPath, 'admin.html');
    if (fs.existsSync(file)) res.sendFile(file);
    else res.status(404).send('admin.html não encontrado');
});

// ============================================================
//  ROTAS DA API
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Servidor rodando!',
        ambiente: NODE_ENV,
        jwt_configurado: JWT_SECRET !== 'fallback-secret-nao-use-em-producao',
        frontendPath: frontendPath,
        cwd: __dirname
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

// TAREFAS - LISTAR
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
            ORDER BY t.data_criacao DESC
        `);
        for (let tarefa of tarefas) {
            const [subtarefas] = await db.query('SELECT * FROM subtarefas WHERE tarefa_id = ?', [tarefa.id]);
            tarefa.subtarefas = subtarefas || [];
        }
        res.json(tarefas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

// TAREFAS - CRIAR
app.post('/api/tarefas', auth.autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { titulo, tag, subtarefas, responsavel_id } = req.body;
        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }
        const [result] = await db.query(
            'INSERT INTO tarefas (usuario_id, titulo, tag, status, responsavel_id) VALUES (?, ?, ?, ?, ?)',
            [usuarioId, titulo, tag || '', 'todo', responsavel_id || null]
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
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

// TAREFAS - ATUALIZAR
app.put('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { titulo, tag, subtarefas, responsavel_id } = req.body;
        await db.query('UPDATE tarefas SET titulo = ?, tag = ?, responsavel_id = ? WHERE id = ?',
            [titulo, tag || '', responsavel_id || null, tarefaId]);
        await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [tarefaId]);
        if (subtarefas && subtarefas.length > 0) {
            for (let sub of subtarefas) {
                await db.query('INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                    [tarefaId, sub.texto, sub.concluida || 0]);
            }
        }
        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
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
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

// ADMIN
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

// FALLBACK
app.get('*', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send(`
            <h1>404 - Página não encontrada</h1>
            <p>index.html não encontrado em: ${frontendPath}</p>
            <p><a href="/api/health">Verificar status</a></p>
        `);
    }
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API: https://richardangelo.net/api/health`);
    console.log(`📂 Frontend: ${frontendPath}`);
});

process.on('uncaughtException', (err) => console.error('❌ Erro:', err));
process.on('unhandledRejection', (err) => console.error('❌ Erro:', err));

console.log('✅ Servidor iniciado com sucesso!');