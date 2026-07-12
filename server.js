// server.js - Versão com SISTEMA DE APROVAÇÃO DE USUÁRIOS
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
    isAdmin: true,
    status: 'aprovado'
};

let usuarios = [ADMIN_USER];
let tarefas = [];
let subtarefaIdCounter = 1;

// ============================================================
//  ROTAS DE AUTENTICAÇÃO
// ============================================================

// Login - VERIFICA SE USUÁRIO FOI APROVADO
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

        // VERIFICAR SE O USUÁRIO FOI APROVADO
        if (usuario.status === 'pendente') {
            return res.status(401).json({
                erro: 'Aguardando aprovação do administrador. Você receberá um email quando for aprovado.'
            });
        }

        if (usuario.status === 'rejeitado') {
            return res.status(401).json({
                erro: 'Seu cadastro foi rejeitado pelo administrador. Entre em contato para mais informações.'
            });
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
                isAdmin: usuario.isAdmin || false,
                status: usuario.status
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

// Cadastro - USUÁRIO FICA PENDENTE
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
            isAdmin: false,
            status: 'pendente',
            data_cadastro: new Date().toISOString()
        };

        usuarios.push(novoUsuario);
        console.log(`📝 Novo cadastro PENDENTE: ${email} (ID: ${novoUsuario.id})`);

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
//  ROTAS DE USUÁRIOS
// ============================================================

// Listar todos os usuários (para admin)
app.get('/api/usuarios', (req, res) => {
    try {
        const usuariosList = usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            status: u.status || 'aprovado',
            isAdmin: u.isAdmin || false
        }));
        res.json(usuariosList);
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro ao carregar usuários' });
    }
});

// ============================================================
//  ROTAS DE ADMIN - GERENCIAR USUÁRIOS
// ============================================================

// Listar todos os usuários com detalhes para admin
app.get('/api/admin/usuarios', (req, res) => {
    try {
        const usuariosList = usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            is_admin: u.isAdmin ? 1 : 0,
            status: u.status || 'aprovado',
            total_tarefas: tarefas.filter(t => t.responsavel_id === u.id || t.usuario_id === u.id).length,
            criado_em: u.data_cadastro || new Date().toISOString()
        }));
        res.json(usuariosList);
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro ao carregar usuários' });
    }
});

// APROVAR USUÁRIO
app.patch('/api/admin/usuarios/:id/aprovar', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const usuario = usuarios.find(u => u.id === id);

        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        if (usuario.isAdmin) {
            return res.status(403).json({ erro: 'Administradores não precisam de aprovação' });
        }

        usuario.status = 'aprovado';
        console.log(`✅ Usuário ${usuario.email} foi APROVADO!`);
        res.json({
            mensagem: `Usuário ${usuario.nome} aprovado com sucesso!`,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, status: usuario.status }
        });
    } catch (error) {
        console.error('❌ Erro ao aprovar usuário:', error);
        res.status(500).json({ erro: 'Erro ao aprovar usuário' });
    }
});

// REJEITAR USUÁRIO
app.patch('/api/admin/usuarios/:id/rejeitar', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const usuario = usuarios.find(u => u.id === id);

        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        if (usuario.isAdmin) {
            return res.status(403).json({ erro: 'Não é possível rejeitar um administrador' });
        }

        usuario.status = 'rejeitado';
        console.log(`❌ Usuário ${usuario.email} foi REJEITADO!`);
        res.json({
            mensagem: `Usuário ${usuario.nome} rejeitado.`,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, status: usuario.status }
        });
    } catch (error) {
        console.error('❌ Erro ao rejeitar usuário:', error);
        res.status(500).json({ erro: 'Erro ao rejeitar usuário' });
    }
});

// DELETAR USUÁRIO
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
        console.log(`🗑️ Usuário ${usuario ? usuario.email : id} deletado`);
        res.json({ mensagem: 'Usuário deletado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao deletar usuário:', error);
        res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }
});

// ============================================================
//  ROTAS DE TAREFAS
// ============================================================

// Listar tarefas (exclui assistência)
app.get('/api/tarefas', (req, res) => {
    try {
        const tarefasFiltradas = tarefas
            .filter(t => t.tag !== 'assistencia')
            .map(t => {
                const responsavel = usuarios.find(u => u.id === t.responsavel_id);
                const criador = usuarios.find(u => u.id === t.usuario_id);
                return {
                    ...t,
                    responsavel_nome: responsavel ? responsavel.nome : null,
                    criador_nome: criador ? criador.nome : 'Administrador',
                    criador_id: t.usuario_id || 1
                };
            });

        console.log(`📋 Carregando ${tarefasFiltradas.length} tarefas`);
        res.json(tarefasFiltradas);
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas:', error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas' });
    }
});

// Listar tarefas de assistência
app.get('/api/tarefas/assistencia', (req, res) => {
    try {
        const tarefasAssistencia = tarefas
            .filter(t => t.tag === 'assistencia')
            .map(t => {
                const responsavel = usuarios.find(u => u.id === t.responsavel_id);
                const criador = usuarios.find(u => u.id === t.usuario_id);
                return {
                    ...t,
                    responsavel_nome: responsavel ? responsavel.nome : null,
                    criador_nome: criador ? criador.nome : 'Administrador',
                    criador_id: t.usuario_id || 1
                };
            });

        console.log(`🔧 Carregando ${tarefasAssistencia.length} tarefas de assistência`);
        res.json(tarefasAssistencia);
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas de assistência:', error);
        res.status(500).json({ erro: 'Erro ao carregar tarefas de assistência' });
    }
});

// Criar tarefa
app.post('/api/tarefas', (req, res) => {
    try {
        const { titulo, tag, subtarefas: subtarefasList, responsavel_id, prazo } = req.body;

        if (!titulo) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }

        const subtarefasComId = (subtarefasList || []).map(s => ({
            id: subtarefaIdCounter++,
            texto: s.texto,
            concluida: s.concluida || 0
        }));

        const novaTarefa = {
            id: tarefas.length + 1,
            usuario_id: 1,
            titulo: titulo,
            tag: tag || '',
            status: 'todo',
            responsavel_id: responsavel_id || null,
            prazo: prazo || null,
            data_criacao: new Date().toISOString(),
            subtarefas: subtarefasComId
        };

        tarefas.push(novaTarefa);
        console.log(`✅ Tarefa criada: ${titulo}`);
        res.json({
            id: novaTarefa.id,
            mensagem: 'Tarefa criada com sucesso!'
        });
    } catch (error) {
        console.error('❌ Erro ao criar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao criar tarefa' });
    }
});

// Atualizar tarefa
app.put('/api/tarefas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { titulo, tag, subtarefas: subtarefasList, responsavel_id, prazo } = req.body;
        const tarefa = tarefas.find(t => t.id === id);

        if (!tarefa) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }

        const subtarefasExistentes = tarefa.subtarefas || [];
        const novasSubtarefas = (subtarefasList || []).map(s => {
            const existente = subtarefasExistentes.find(e => e.texto === s.texto);
            if (existente) {
                return { ...existente, concluida: s.concluida || 0 };
            }
            return {
                id: subtarefaIdCounter++,
                texto: s.texto,
                concluida: s.concluida || 0
            };
        });

        tarefa.titulo = titulo || tarefa.titulo;
        tarefa.tag = tag || tarefa.tag;
        tarefa.responsavel_id = responsavel_id || tarefa.responsavel_id;
        tarefa.prazo = prazo || tarefa.prazo;
        tarefa.subtarefas = novasSubtarefas;

        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao atualizar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
    }
});

// Atualizar status da tarefa
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
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
});

// Alternar subtarefa
app.patch('/api/subtarefas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { concluida } = req.body;

        let subtarefaEncontrada = false;
        for (const tarefa of tarefas) {
            if (tarefa.subtarefas) {
                const subtarefa = tarefa.subtarefas.find(s => s.id === id);
                if (subtarefa) {
                    subtarefa.concluida = concluida ? 1 : 0;
                    subtarefaEncontrada = true;

                    const todasConcluidas = tarefa.subtarefas.every(s => s.concluida === 1);
                    if (todasConcluidas && tarefa.status !== 'done') {
                        tarefa.status = 'done';
                    }

                    return res.json({ mensagem: 'Subtarefa atualizada!' });
                }
            }
        }

        if (!subtarefaEncontrada) {
            return res.status(404).json({ erro: 'Subtarefa não encontrada' });
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar subtarefa:', error);
        res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
    }
});

// Deletar tarefa
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
        console.error('❌ Erro ao deletar tarefa:', error);
        res.status(500).json({ erro: 'Erro ao deletar tarefa' });
    }
});

// ============================================================
//  ROTAS DE ADMIN - ESTATÍSTICAS
// ============================================================

app.get('/api/admin/estatisticas', (req, res) => {
    try {
        const totalSubtarefas = tarefas.reduce((acc, t) => acc + (t.subtarefas ? t.subtarefas.length : 0), 0);
        const pendentes = usuarios.filter(u => u.status === 'pendente').length;
        const aprovados = usuarios.filter(u => u.status === 'aprovado' || u.isAdmin).length;
        const rejeitados = usuarios.filter(u => u.status === 'rejeitado').length;

        res.json({
            total_usuarios: usuarios.length,
            usuarios_pendentes: pendentes,
            usuarios_aprovados: aprovados,
            usuarios_rejeitados: rejeitados,
            total_tarefas: tarefas.length,
            total_subtarefas: totalSubtarefas
        });
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

// ============================================================
//  HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
    const pendentes = usuarios.filter(u => u.status === 'pendente').length;
    res.json({
        status: 'ok',
        mensagem: 'Volmanday Server rodando no Railway!',
        porta: PORT,
        timestamp: new Date().toISOString(),
        usuarios: usuarios.length,
        usuarios_pendentes: pendentes,
        tarefas: tarefas.length
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
    console.log(`📊 Usuários: ${usuarios.length} (${usuarios.filter(u => u.status === 'pendente').length} pendentes)`);
});