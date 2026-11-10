// server.js - Versão com MySQL (persistente)
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Iniciando servidor VolControl...');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const codigosRecuperacao = {};

// ============================================================
//  FUNÇÕES AUXILIARES DO BANCO
// ============================================================

async function testDbConnection() {
    try {
        const [result] = await db.query('SELECT 1+1 as test');
        console.log('✅ Conexão com o banco OK!');
        return true;
    } catch (error) {
        console.error('❌ Erro na conexão com o banco:', error.message);
        return false;
    }
}

async function getUsuarioByEmail(email) {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    return rows && rows.length > 0 ? rows[0] : null;
}

async function getAllUsuarios() {
    const [rows] = await db.query('SELECT id, nome, email, is_admin, status, criado_em FROM usuarios ORDER BY criado_em DESC');
    return rows || [];
}

async function createUsuario(nome, email, senha) {
    const salt = bcrypt.genSaltSync(10);
    const senhaHash = bcrypt.hashSync(senha, salt);
    const [result] = await db.query(
        'INSERT INTO usuarios (nome, email, senha, is_admin, status) VALUES (?, ?, ?, ?, ?)',
        [nome, email, senhaHash, 0, 'pendente']
    );
    return result.insertId;
}

async function updateUsuarioStatus(id, status) {
    await db.query('UPDATE usuarios SET status = ? WHERE id = ?', [status, id]);
}

async function deleteUsuario(id) {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
}

// ============================================================
//  GET TAREFAS - GARANTINDO FORMATO DA DATA
// ============================================================

async function getTarefas() {
    try {
        const [rows] = await db.query(`
            SELECT t.*, t.aprovado, t.observacao,
                   u.nome as criador_nome,
                   GROUP_CONCAT(DISTINCT r.usuario_id) as responsaveis_ids,
                   GROUP_CONCAT(DISTINCT u2.nome) as responsaveis_nomes
            FROM tarefas t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            LEFT JOIN tarefa_responsaveis r ON t.id = r.tarefa_id
            LEFT JOIN usuarios u2 ON r.usuario_id = u2.id
            WHERE t.tag != 'assistencia' OR t.tag IS NULL
            GROUP BY t.id
            ORDER BY t.data_criacao DESC
        `);

        for (const tarefa of rows || []) {
            const [subtasks] = await db.query('SELECT * FROM subtarefas WHERE tarefa_id = ?', [tarefa.id]);
            tarefa.subtarefas = subtasks || [];
            tarefa.responsaveis_ids = tarefa.responsaveis_ids ? tarefa.responsaveis_ids.split(',').map(Number) : [];
            tarefa.responsaveis_nomes = tarefa.responsaveis_nomes ? tarefa.responsaveis_nomes.split(',') : [];

            if (tarefa.prazo) {
                const data = new Date(tarefa.prazo);
                if (!isNaN(data.getTime())) {
                    tarefa.prazo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
                }
            }

            // FORÇA A DATA DE FINALIZAÇÃO A SER TEXTO PURO
            if (tarefa.data_finalizacao) {
                const dataFin = new Date(tarefa.data_finalizacao);
                if (!isNaN(dataFin.getTime())) {
                    tarefa.data_finalizacao = `${dataFin.getFullYear()}-${String(dataFin.getMonth() + 1).padStart(2, '0')}-${String(dataFin.getDate()).padStart(2, '0')}`;
                } else {
                    tarefa.data_finalizacao = String(tarefa.data_finalizacao).split('T')[0];
                }
            } else {
                tarefa.data_finalizacao = null;
            }
        }
        return rows || [];
    } catch (error) {
        console.error('❌ Erro em getTarefas:', error.message);
        return [];
    }
}

async function getTarefasAssistencia() {
    try {
        const [rows] = await db.query(`
            SELECT t.*, t.aprovado, t.observacao,
                   u.nome as criador_nome,
                   GROUP_CONCAT(DISTINCT r.usuario_id) as responsaveis_ids,
                   GROUP_CONCAT(DISTINCT u2.nome) as responsaveis_nomes
            FROM tarefas t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            LEFT JOIN tarefa_responsaveis r ON t.id = r.tarefa_id
            LEFT JOIN usuarios u2 ON r.usuario_id = u2.id
            WHERE t.tag = 'assistencia'
            GROUP BY t.id
            ORDER BY t.data_criacao DESC
        `);

        for (const tarefa of rows || []) {
            const [subtasks] = await db.query('SELECT * FROM subtarefas WHERE tarefa_id = ?', [tarefa.id]);
            tarefa.subtarefas = subtasks || [];
            tarefa.responsaveis_ids = tarefa.responsaveis_ids ? tarefa.responsaveis_ids.split(',').map(Number) : [];
            tarefa.responsaveis_nomes = tarefa.responsaveis_nomes ? tarefa.responsaveis_nomes.split(',') : [];

            if (tarefa.prazo) {
                const data = new Date(tarefa.prazo);
                if (!isNaN(data.getTime())) {
                    tarefa.prazo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
                }
            }

            // FORÇA A DATA DE FINALIZAÇÃO A SER TEXTO PURO
            if (tarefa.data_finalizacao) {
                const dataFin = new Date(tarefa.data_finalizacao);
                if (!isNaN(dataFin.getTime())) {
                    tarefa.data_finalizacao = `${dataFin.getFullYear()}-${String(dataFin.getMonth() + 1).padStart(2, '0')}-${String(dataFin.getDate()).padStart(2, '0')}`;
                } else {
                    tarefa.data_finalizacao = String(tarefa.data_finalizacao).split('T')[0];
                }
            } else {
                tarefa.data_finalizacao = null;
            }
        }
        return rows || [];
    } catch (error) {
        console.error('❌ Erro em getTarefasAssistencia:', error.message);
        return [];
    }
}

// ============================================================
//  CREATE / UPDATE / STATUS
// ============================================================

async function createTarefa(usuario_id, titulo, tag, subtarefas, responsaveis, prazo, observacao) {
    let prazoFormatado = prazo ? (prazo.includes('T') ? prazo.split('T')[0] : prazo) : null;
    const [result] = await db.query(
        'INSERT INTO tarefas (usuario_id, titulo, tag, prazo, aprovado, observacao) VALUES (?, ?, ?, ?, ?, ?)',
        [usuario_id, titulo, tag || '', prazoFormatado, 0, observacao || null]
    );
    const tarefaId = result.insertId;

    for (const sub of (subtarefas || [])) {
        await db.query('INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)', [tarefaId, sub.texto, sub.concluida || 0]);
    }
    for (const respId of (responsaveis || [])) {
        await db.query('INSERT INTO tarefa_responsaveis (tarefa_id, usuario_id) VALUES (?, ?)', [tarefaId, respId]);
    }
    return tarefaId;
}

async function updateTarefa(id, titulo, tag, subtarefas, responsaveis, prazo, observacao) {
    let prazoFormatado = prazo ? (prazo.includes('T') ? prazo.split('T')[0] : prazo) : null;
    await db.query('UPDATE tarefas SET titulo = ?, tag = ?, prazo = ?, observacao = ? WHERE id = ?', [titulo, tag || '', prazoFormatado, observacao || null, id]);
    await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [id]);
    for (const sub of (subtarefas || [])) {
        await db.query('INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)', [id, sub.texto, sub.concluida || 0]);
    }
    await db.query('DELETE FROM tarefa_responsaveis WHERE tarefa_id = ?', [id]);
    for (const respId of (responsaveis || [])) {
        await db.query('INSERT INTO tarefa_responsaveis (tarefa_id, usuario_id) VALUES (?, ?)', [id, respId]);
    }
}

async function updateTarefaStatus(id, status) {
    try {
        if (status === 'done') {
            // Força o fuso horário do Brasil (UTC-3)
            const agora = new Date();
            const dataBrasil = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
            const dataFormatada = `${dataBrasil.getFullYear()}-${String(dataBrasil.getMonth() + 1).padStart(2, '0')}-${String(dataBrasil.getDate()).padStart(2, '0')}`;

            await db.query('UPDATE tarefas SET status = ?, data_finalizacao = ? WHERE id = ?', [status, dataFormatada, id]);
        } else {
            await db.query('UPDATE tarefas SET status = ?, data_finalizacao = NULL WHERE id = ?', [status, id]);
        }
    } catch (error) {
        console.error('❌ Erro em updateTarefaStatus:', error.message);
        throw error;
    }
}

async function deleteTarefa(id) { await db.query('DELETE FROM tarefas WHERE id = ?', [id]); }
async function toggleSubtarefa(id, concluida) { await db.query('UPDATE subtarefas SET concluida = ? WHERE id = ?', [concluida, id]); }

function getUsuarioIdFromToken(authHeader) {
    if (!authHeader) return 1;
    try {
        const token = authHeader.split(' ')[1];
        if (token && token.startsWith('fake-token-')) {
            const parts = token.split('-');
            if (parts.length >= 4) {
                const id = parseInt(parts[3]);
                if (!isNaN(id) && id > 0 && id < 1000000) return id;
            }
        }
        return 1;
    } catch { return 1; }
}

// ============================================================
//  ROTAS DE AUTENTICAÇÃO E ADMIN
// ============================================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await getUsuarioByEmail(email);
        if (!usuario) return res.status(401).json({ erro: 'Email ou senha incorretos' });
        if (usuario.status === 'pendente') return res.status(401).json({ erro: 'Aguardando aprovação do administrador.' });
        if (usuario.status === 'rejeitado') return res.status(401).json({ erro: 'Seu cadastro foi rejeitado.' });
        if (!bcrypt.compareSync(senha, usuario.senha)) return res.status(401).json({ erro: 'Email ou senha incorretos' });

        res.json({
            mensagem: 'Login bem-sucedido!',
            token: `fake-token-${Date.now()}-${usuario.id}`,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, isAdmin: usuario.is_admin === 1, status: usuario.status }
        });
    } catch (error) { res.status(500).json({ erro: 'Erro interno' }); }
});

app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        if (await getUsuarioByEmail(email)) return res.status(400).json({ erro: 'Email já cadastrado' });
        await createUsuario(nome, email, senha);
        res.json({ mensagem: 'Cadastro realizado! Aguarde aprovação.', pendente: true });
    } catch (error) { res.status(500).json({ erro: 'Erro interno' }); }
});

app.get('/api/usuarios', async (req, res) => { res.json(await getAllUsuarios()); });
app.get('/api/admin/usuarios', async (req, res) => { res.json(await getAllUsuarios()); });
app.patch('/api/admin/usuarios/:id/aprovar', async (req, res) => { await updateUsuarioStatus(parseInt(req.params.id), 'aprovado'); res.json({ mensagem: 'Aprovado!' }); });
app.patch('/api/admin/usuarios/:id/rejeitar', async (req, res) => { await updateUsuarioStatus(parseInt(req.params.id), 'rejeitado'); res.json({ mensagem: 'Rejeitado!' }); });
app.delete('/api/admin/usuarios/:id', async (req, res) => { await deleteUsuario(parseInt(req.params.id)); res.json({ mensagem: 'Deletado!' }); });

// ============================================================
//  ROTAS DE TAREFAS
// ============================================================

app.get('/api/tarefas', async (req, res) => { res.json(await getTarefas()); });
app.get('/api/tarefas/assistencia', async (req, res) => { res.json(await getTarefasAssistencia()); });

app.post('/api/tarefas', async (req, res) => {
    const { titulo, tag, subtarefas, responsaveis, prazo, observacao } = req.body;
    const usuarioId = getUsuarioIdFromToken(req.headers.authorization);
    const id = await createTarefa(usuarioId, titulo, tag, subtarefas, responsaveis, prazo, observacao);
    res.json({ id, mensagem: 'Tarefa criada!' });
});

app.post('/api/tarefas/assistencia', async (req, res) => {
    const { titulo, tag, subtarefas, responsaveis, prazo, observacao } = req.body;
    const usuarioId = getUsuarioIdFromToken(req.headers.authorization);
    const id = await createTarefa(usuarioId, titulo, 'assistencia', subtarefas, responsaveis, prazo, observacao);
    res.json({ id, mensagem: 'Tarefa criada!' });
});

app.put('/api/tarefas/:id', async (req, res) => {
    const { titulo, tag, subtarefas, responsaveis, prazo, observacao } = req.body;
    await updateTarefa(parseInt(req.params.id), titulo, tag, subtarefas, responsaveis, prazo, observacao);
    res.json({ mensagem: 'Tarefa atualizada!' });
});

app.patch('/api/tarefas/:id/status', async (req, res) => {
    await updateTarefaStatus(parseInt(req.params.id), req.body.status);
    res.json({ mensagem: 'Status atualizado!' });
});

app.patch('/api/tarefas/:id/aprovar', async (req, res) => {
    await db.query('UPDATE tarefas SET aprovado = 1 WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ mensagem: 'Aprovada!' });
});

app.patch('/api/tarefas/:id/desaprovar', async (req, res) => {
    await db.query('UPDATE tarefas SET aprovado = 0 WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ mensagem: 'Aprovação removida!' });
});

app.patch('/api/subtarefas/:id', async (req, res) => {
    await toggleSubtarefa(parseInt(req.params.id), req.body.concluida);
    res.json({ mensagem: 'Subtarefa atualizada!' });
});

app.delete('/api/tarefas/:id', async (req, res) => {
    await deleteTarefa(parseInt(req.params.id));
    res.json({ mensagem: 'Tarefa deletada!' });
});

// ============================================================
//  RECUPERAÇÃO DE SENHA E ESTATÍSTICAS
// ============================================================

app.post('/api/recuperar', async (req, res) => {
    const usuario = await getUsuarioByEmail(req.body.email);
    if (!usuario) return res.status(404).json({ erro: 'Email não encontrado' });
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacao[req.body.email] = { codigo, expiraEm: Date.now() + 15 * 60 * 1000 };
    res.json({ mensagem: 'Código enviado!', codigo });
});

app.post('/api/resetar-senha', async (req, res) => {
    const { email, codigo, novaSenha } = req.body;
    const reg = codigosRecuperacao[email];
    if (!reg || reg.codigo !== codigo || Date.now() > reg.expiraEm) return res.status(400).json({ erro: 'Código inválido/expirado' });
    const senhaHash = bcrypt.hashSync(novaSenha, bcrypt.genSaltSync(10));
    await db.query('UPDATE usuarios SET senha = ? WHERE email = ?', [senhaHash, email]);
    delete codigosRecuperacao[email];
    res.json({ mensagem: 'Senha redefinida!' });
});

app.get('/api/admin/estatisticas', async (req, res) => {
    const [u] = await db.query('SELECT COUNT(*) as total FROM usuarios');
    const [t] = await db.query('SELECT COUNT(*) as total FROM tarefas');
    const [s] = await db.query('SELECT COUNT(*) as total FROM subtarefas');
    const [p] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE status = "pendente"');
    res.json({ total_usuarios: u[0].total, total_tarefas: t[0].total, total_subtarefas: s[0].total, usuarios_pendentes: p[0].total });
});

// ============================================================
//  ROTAS DAS PÁGINAS E INICIALIZAÇÃO
// ============================================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/cadastro.html', (req, res) => res.sendFile(path.join(__dirname, 'cadastro.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/assistencia.html', (req, res) => res.sendFile(path.join(__dirname, 'assistencia.html')));
app.get('/recuperar.html', (req, res) => res.sendFile(path.join(__dirname, 'recuperar.html')));
app.get('/resetar.html', (req, res) => res.sendFile(path.join(__dirname, 'resetar.html')));

app.get('/api/health', async (req, res) => {
    try { await db.query('SELECT 1+1'); res.json({ status: 'ok', db: 'conectado' }); }
    catch (error) { res.status(500).json({ status: 'erro', erro: error.message }); }
});

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

(async function init() {
    if (!await testDbConnection()) process.exit(1);
})();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VolControl Server rodando na porta ${PORT}`);
    console.log(`🗄️ Usando MySQL como banco de dados!`);
});