// server.js - Versão com MySQL (persistente) - CORRIGIDO
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Iniciando servidor VolControl...');

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
app.use(express.static(__dirname));

// ============================================================
//  RECUPERAÇÃO DE SENHA - ARMAZENAR CÓDIGOS (em memória ainda)
// ============================================================

const codigosRecuperacao = {};

// ============================================================
//  FUNÇÕES AUXILIARES DO BANCO - CORRIGIDAS
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
    try {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('❌ Erro em getUsuarioByEmail:', error.message);
        throw error;
    }
}

async function getUsuarioById(id) {
    try {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('❌ Erro em getUsuarioById:', error.message);
        throw error;
    }
}

async function getAllUsuarios() {
    try {
        const [rows] = await db.query('SELECT id, nome, email, is_admin, status, criado_em FROM usuarios ORDER BY criado_em DESC');
        return rows || [];
    } catch (error) {
        console.error('❌ Erro em getAllUsuarios:', error.message);
        return [];
    }
}

async function createUsuario(nome, email, senha) {
    try {
        const salt = bcrypt.genSaltSync(10);
        const senhaHash = bcrypt.hashSync(senha, salt);
        const [result] = await db.query(
            'INSERT INTO usuarios (nome, email, senha, is_admin, status) VALUES (?, ?, ?, ?, ?)',
            [nome, email, senhaHash, 0, 'pendente']
        );
        return result.insertId;
    } catch (error) {
        console.error('❌ Erro em createUsuario:', error.message);
        throw error;
    }
}

async function updateUsuarioStatus(id, status) {
    try {
        await db.query('UPDATE usuarios SET status = ? WHERE id = ?', [status, id]);
    } catch (error) {
        console.error('❌ Erro em updateUsuarioStatus:', error.message);
        throw error;
    }
}

async function deleteUsuario(id) {
    try {
        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    } catch (error) {
        console.error('❌ Erro em deleteUsuario:', error.message);
        throw error;
    }
}

async function getTarefas() {
    try {
        const [rows] = await db.query(`
            SELECT t.*, 
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
            SELECT t.*, 
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
        }

        return rows || [];
    } catch (error) {
        console.error('❌ Erro em getTarefasAssistencia:', error.message);
        return [];
    }
}

async function createTarefa(usuario_id, titulo, tag, subtarefas, responsaveis, prazo) {
    try {
        const [result] = await db.query(
            'INSERT INTO tarefas (usuario_id, titulo, tag, prazo) VALUES (?, ?, ?, ?)',
            [usuario_id, titulo, tag || '', prazo || null]
        );
        const tarefaId = result.insertId;

        for (const sub of (subtarefas || [])) {
            await db.query(
                'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                [tarefaId, sub.texto, sub.concluida || 0]
            );
        }

        for (const respId of (responsaveis || [])) {
            await db.query(
                'INSERT INTO tarefa_responsaveis (tarefa_id, usuario_id) VALUES (?, ?)',
                [tarefaId, respId]
            );
        }

        return tarefaId;
    } catch (error) {
        console.error('❌ Erro em createTarefa:', error.message);
        throw error;
    }
}

async function updateTarefa(id, titulo, tag, subtarefas, responsaveis, prazo) {
    try {
        await db.query(
            'UPDATE tarefas SET titulo = ?, tag = ?, prazo = ? WHERE id = ?',
            [titulo, tag || '', prazo || null, id]
        );

        await db.query('DELETE FROM subtarefas WHERE tarefa_id = ?', [id]);
        for (const sub of (subtarefas || [])) {
            await db.query(
                'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                [id, sub.texto, sub.concluida || 0]
            );
        }

        await db.query('DELETE FROM tarefa_responsaveis WHERE tarefa_id = ?', [id]);
        for (const respId of (responsaveis || [])) {
            await db.query(
                'INSERT INTO tarefa_responsaveis (tarefa_id, usuario_id) VALUES (?, ?)',
                [id, respId]
            );
        }
    } catch (error) {
        console.error('❌ Erro em updateTarefa:', error.message);
        throw error;
    }
}

async function updateTarefaStatus(id, status) {
    try {
        await db.query('UPDATE tarefas SET status = ? WHERE id = ?', [status, id]);
    } catch (error) {
        console.error('❌ Erro em updateTarefaStatus:', error.message);
        throw error;
    }
}

async function deleteTarefa(id) {
    try {
        await db.query('DELETE FROM tarefas WHERE id = ?', [id]);
    } catch (error) {
        console.error('❌ Erro em deleteTarefa:', error.message);
        throw error;
    }
}

async function toggleSubtarefa(id, concluida) {
    try {
        await db.query('UPDATE subtarefas SET concluida = ? WHERE id = ?', [concluida, id]);
    } catch (error) {
        console.error('❌ Erro em toggleSubtarefa:', error.message);
        throw error;
    }
}

async function getEstatisticas() {
    try {
        const [usuarios] = await db.query('SELECT COUNT(*) as total FROM usuarios');
        const [tarefas] = await db.query('SELECT COUNT(*) as total FROM tarefas');
        const [subtarefas] = await db.query('SELECT COUNT(*) as total FROM subtarefas');
        const [pendentes] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE status = "pendente"');
        const [aprovados] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE status = "aprovado" OR is_admin = 1');
        const [rejeitados] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE status = "rejeitado"');

        return {
            total_usuarios: usuarios[0]?.total || 0,
            usuarios_pendentes: pendentes[0]?.total || 0,
            usuarios_aprovados: aprovados[0]?.total || 0,
            usuarios_rejeitados: rejeitados[0]?.total || 0,
            total_tarefas: tarefas[0]?.total || 0,
            total_subtarefas: subtarefas[0]?.total || 0
        };
    } catch (error) {
        console.error('❌ Erro em getEstatisticas:', error.message);
        return {
            total_usuarios: 0,
            usuarios_pendentes: 0,
            usuarios_aprovados: 0,
            usuarios_rejeitados: 0,
            total_tarefas: 0,
            total_subtarefas: 0
        };
    }
}

// ============================================================
//  ROTAS DE AUTENTICAÇÃO
// ============================================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log(`🔐 Tentativa de login: ${email}`);

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const usuario = await getUsuarioByEmail(email);

        if (!usuario) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        if (usuario.status === 'pendente') {
            return res.status(401).json({
                erro: 'Aguardando aprovação do administrador.'
            });
        }

        if (usuario.status === 'rejeitado') {
            return res.status(401).json({
                erro: 'Seu cadastro foi rejeitado.'
            });
        }

        const senhaValida = bcrypt.compareSync(senha, usuario.senha);
        if (!senhaValida) {
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
                isAdmin: usuario.is_admin === 1,
                status: usuario.status
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const usuarioExistente = await getUsuarioByEmail(email);
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        await createUsuario(nome, email, senha);
        console.log(`📝 Novo cadastro PENDENTE: ${email}`);

        res.json({
            mensagem: 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador.',
            pendente: true
        });
    } catch (error) {
        console.error('❌ Erro no cadastro:', error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

// ============================================================
//  ROTAS DE RECUPERAÇÃO DE SENHA
// ============================================================

app.post('/api/recuperar', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ erro: 'Email é obrigatório' });
        }

        const usuario = await getUsuarioByEmail(email);

        if (!usuario) {
            return res.status(404).json({ erro: 'Email não encontrado' });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        codigosRecuperacao[email] = {
            codigo: codigo,
            expiraEm: Date.now() + 15 * 60 * 1000
        };

        console.log(`🔑 Código de recuperação para ${email}: ${codigo}`);

        res.json({
            mensagem: '📧 Código de recuperação enviado para seu email!',
            codigo: codigo,
            email: email
        });
    } catch (error) {
        console.error('❌ Erro na recuperação:', error);
        res.status(500).json({ erro: 'Erro ao processar recuperação' });
    }
});

app.post('/api/resetar-senha', async (req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;

        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ erro: 'Email, código e nova senha são obrigatórios' });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const usuario = await getUsuarioByEmail(email);
        if (!usuario) {
            return res.status(404).json({ erro: 'Email não encontrado' });
        }

        const registro = codigosRecuperacao[email];
        if (!registro || registro.codigo !== codigo) {
            return res.status(400).json({ erro: 'Código inválido' });
        }

        if (Date.now() > registro.expiraEm) {
            delete codigosRecuperacao[email];
            return res.status(400).json({ erro: 'Código expirado' });
        }

        const salt = bcrypt.genSaltSync(10);
        const senhaHash = bcrypt.hashSync(novaSenha, salt);
        await db.query('UPDATE usuarios SET senha = ? WHERE email = ?', [senhaHash, email]);

        delete codigosRecuperacao[email];
        console.log(`🔐 Senha redefinida para ${email}`);

        res.json({ mensagem: '✅ Senha redefinida com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao redefinir senha:', error);
        res.status(500).json({ erro: 'Erro ao redefinir senha' });
    }
});

// ============================================================
//  ROTAS DE USUÁRIOS
// ============================================================

app.get('/api/usuarios', async (req, res) => {
    try {
        const usuarios = await getAllUsuarios();
        res.json(usuarios);
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro ao carregar usuários' });
    }
});

// ============================================================
//  ROTAS DE ADMIN
// ============================================================

app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const usuarios = await getAllUsuarios();
        res.json(usuarios);
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro ao carregar usuários' });
    }
});

app.patch('/api/admin/usuarios/:id/aprovar', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await updateUsuarioStatus(id, 'aprovado');
        console.log(`✅ Usuário ${id} APROVADO!`);
        res.json({ mensagem: 'Usuário aprovado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao aprovar usuário:', error);
        res.status(500).json({ erro: 'Erro ao aprovar usuário' });
    }
});

app.patch('/api/admin/usuarios/:id/rejeitar', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await updateUsuarioStatus(id, 'rejeitado');
        console.log(`❌ Usuário ${id} REJEITADO!`);
        res.json({ mensagem: 'Usuário rejeitado!' });
    } catch (error) {
        console.error('❌ Erro ao rejeitar usuário:', error);
        res.status(500).json({ erro: 'Erro ao rejeitar usuário' });
    }
});

app.delete('/api/admin/usuarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deleteUsuario(id);
        console.log(`🗑️ Usuário ${id} deletado`);
        res.json({ mensagem: 'Usuário deletado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao deletar usuário:', error);
        res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }
});

// ============================================================
//  ROTAS DE TAREFAS
// ============================================================

app.get('/api/tarefas', async (req, res) => {
    try {
        const tarefas = await getTarefas();
        console.log(`📋 Carregando ${tarefas.length} tarefas`);
        res.json(tarefas);
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas:', error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

app.get('/api/tarefas/assistencia', async (req, res) => {
    try {
        const tarefas = await getTarefasAssistencia();
        console.log(`🔧 Carregando ${tarefas.length} tarefas de assistência`);
        res.json(tarefas);
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas de assistência:', error);
        res.status(500).json({ erro: 'Erro ao carregar tarefas' });
    }
});

app.post('/api/tarefas', async (req, res) => {
    try {
        const { titulo, tag, subtarefas, responsaveis, prazo } = req.body;

        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }

        const id = await createTarefa(1, titulo, tag, subtarefas, responsaveis, prazo);
        console.log(`✅ Tarefa criada: ${titulo}`);
        res.json({ id, mensagem: 'Tarefa criada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao criar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

app.put('/api/tarefas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { titulo, tag, subtarefas, responsaveis, prazo } = req.body;

        await updateTarefa(id, titulo, tag, subtarefas, responsaveis, prazo);
        console.log(`✏️ Tarefa ${id} atualizada`);
        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
    }
});

app.patch('/api/tarefas/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        await updateTarefaStatus(id, status);
        res.json({ mensagem: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
});

app.patch('/api/subtarefas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { concluida } = req.body;

        await toggleSubtarefa(id, concluida);
        res.json({ mensagem: 'Subtarefa atualizada!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar subtarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
    }
});

app.delete('/api/tarefas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deleteTarefa(id);
        res.json({ mensagem: 'Tarefa deletada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao deletar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

// ============================================================
//  ROTAS DE ADMIN - ESTATÍSTICAS
// ============================================================

app.get('/api/admin/estatisticas', async (req, res) => {
    try {
        const stats = await getEstatisticas();
        res.json(stats);
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
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

app.get('/recuperar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'recuperar.html'));
});

app.get('/resetar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'resetar.html'));
});

// ============================================================
//  HEALTH CHECK
// ============================================================

app.get('/api/health', async (req, res) => {
    try {
        const [result] = await db.query('SELECT 1+1 as test');
        res.json({
            status: 'ok',
            mensagem: 'VolControl Server com MySQL!',
            porta: PORT,
            timestamp: new Date().toISOString(),
            db: 'conectado'
        });
    } catch (error) {
        res.status(500).json({
            status: 'erro',
            mensagem: 'Erro na conexão com o banco',
            erro: error.message
        });
    }
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
//  INICIAR SERVIDOR - COM TESTE DE CONEXÃO
// ============================================================

// Testar conexão com o banco antes de iniciar
(async function init() {
    try {
        console.log('🔄 Testando conexão com o MySQL...');
        const connected = await testDbConnection();
        if (!connected) {
            console.error('❌ Não foi possível conectar ao MySQL. Verifique as variáveis de ambiente.');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Erro ao testar conexão:', error);
        process.exit(1);
    }
})();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VolControl Server rodando na porta ${PORT}`);
    console.log(`📋 API Health: /api/health`);
    console.log(`👤 Admin: admin@admin.com / admin123`);
    console.log(`🗄️  Usando MySQL como banco de dados!`);
});