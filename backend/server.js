// server.js - Servidor principal (VERSÃO HOSTINGER - CORRIGIDA)
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
//  ENCONTRAR PASTA DO FRONTEND - VERSÃO HOSTINGER
// ============================================================

function encontrarFrontend() {
    // Possíveis caminhos para o frontend na Hostinger
    const possiveisCaminhos = [
        // Caminho mais provável - frontend dentro do nodejs
        path.join(__dirname, 'frontend'),

        // Caminho absoluto da Hostinger
        '/home/u332502777/domains/richardangelo.net/nodejs/frontend',
        '/home/u332502777/domains/richardangelo.net/public_html',
        '/home/u332502777/domains/richardangelo.net/public_html/frontend',

        // Caminhos relativos
        path.join(__dirname, '../frontend'),
        path.join(__dirname, '../public_html'),
        path.join(__dirname, '../public_html/frontend'),
        path.join(__dirname, '..'),
        path.join(__dirname, '.'),
    ];

    console.log('🔍 Procurando frontend...');
    for (const caminho of possiveisCaminhos) {
        try {
            const indexFile = path.join(caminho, 'index.html');
            if (fs.existsSync(indexFile)) {
                console.log(`✅ Frontend encontrado em: ${caminho}`);
                return caminho;
            }
        } catch (err) {
            // Ignorar erros de acesso
        }
    }

    // Se não encontrou, listar o que tem na pasta atual
    console.log('📂 Conteúdo de', __dirname);
    try {
        const files = fs.readdirSync(__dirname);
        console.log(files);
    } catch (err) {
        console.log('Erro ao listar:', err.message);
    }

    // Fallback: criar a pasta frontend se não existir
    const fallbackPath = path.join(__dirname, 'frontend');
    console.log(`⚠️ Criando fallback em: ${fallbackPath}`);
    try {
        if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true });
        }
        // Criar um index.html de fallback
        const fallbackIndex = path.join(fallbackPath, 'index.html');
        if (!fs.existsSync(fallbackIndex)) {
            fs.writeFileSync(fallbackIndex, `
<!DOCTYPE html>
<html>
<head><title>Mini Monday</title></head>
<body>
    <h1>Mini Monday</h1>
    <p>Servidor rodando! Faça upload dos arquivos do frontend para a pasta: ${fallbackPath}</p>
    <p><a href="/api/health">Health Check</a></p>
</body>
</html>
            `);
        }
        return fallbackPath;
    } catch (err) {
        console.error('Erro ao criar fallback:', err);
        return __dirname;
    }
}

// Encontrar o frontend
const frontendPath = encontrarFrontend();
console.log(`📂 Servindo frontend de: ${frontendPath}`);

// ============================================================
//  SERVIDOR DE ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================

// Servir arquivos estáticos
app.use(express.static(frontendPath));

// Rota para a página inicial (index.html)
app.get('/', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send(`
            <h1>404 - Página não encontrada</h1>
            <p>O arquivo index.html não foi encontrado em: ${frontendPath}</p>
            <p>Por favor, faça upload dos arquivos do frontend para esta pasta.</p>
            <p><a href="/api/health">Verificar status do servidor</a></p>
        `);
    }
});

// Rota para login
app.get('/login.html', (req, res) => {
    const file = path.join(frontendPath, 'login.html');
    if (fs.existsSync(file)) {
        res.sendFile(file);
    } else {
        res.status(404).send('login.html não encontrado');
    }
});

// Rota para cadastro
app.get('/cadastro.html', (req, res) => {
    const file = path.join(frontendPath, 'cadastro.html');
    if (fs.existsSync(file)) {
        res.sendFile(file);
    } else {
        res.status(404).send('cadastro.html não encontrado');
    }
});

// Rota para admin
app.get('/admin.html', (req, res) => {
    const file = path.join(frontendPath, 'admin.html');
    if (fs.existsSync(file)) {
        res.sendFile(file);
    } else {
        res.status(404).send('admin.html não encontrado');
    }
});

// ============================================================
//  ROTAS PÚBLICAS DA API
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
//  ROTA PARA LISTAR USUÁRIOS
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
//  ROTAS PROTEGIDAS (TAREFAS)
// ============================================================

// Buscar TODAS as tarefas
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

// Criar nova tarefa
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

// Atualizar tarefa
app.put('/api/tarefas/:id', auth.autenticar, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const { titulo, tag, subtarefas, responsavel_id } = req.body;

        console.log(`✏️ Atualizando tarefa ${tarefaId}`);

        await db.query(
            'UPDATE tarefas SET titulo = ?, tag = ?, responsavel_id = ? WHERE id = ?',
            [titulo, tag || '', responsavel_id || null, tarefaId]
        );

        await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [tarefaId]);

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

// Atualizar status da tarefa
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

// Alternar subtarefa
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

// Deletar tarefa
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
//  FALLBACK - Rota para qualquer outra requisição
// ============================================================

app.get('*', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send(`
            <h1>404 - Página não encontrada</h1>
            <p>O arquivo index.html não foi encontrado em: ${frontendPath}</p>
            <p>Por favor, faça upload dos arquivos do frontend para esta pasta.</p>
            <p><a href="/api/health">Verificar status do servidor</a></p>
            <hr>
            <p>Caminho atual: ${__dirname}</p>
            <p>Conteúdo da pasta: ${fs.readdirSync(__dirname).join(', ')}</p>
        `);
    }
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API disponível em https://richardangelo.net/api/health`);
    console.log(`🌐 Ambiente: ${NODE_ENV}`);
    console.log(`📂 Servindo frontend de: ${frontendPath}`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promessa rejeitada:', err);
});

console.log('✅ Servidor iniciado com sucesso!');