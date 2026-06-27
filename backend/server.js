// server.js - Servidor principal (VERSÃO DIGITALOCEAN)
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const auth = require('./auth');
require('dotenv').config();

const app = express();

// ============================================================
//  PORTA DINÂMICA PARA DIGITALOCEAN
//  O App Platform define a variável PORT automaticamente
// ============================================================

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// ============================================================
//  MIDDLEWARE CORS - Configurado para produção
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

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.url}`);
        next();
    });
}

// ============================================================
//  ROTAS PÚBLICAS
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Servidor rodando!',
        ambiente: process.env.NODE_ENV || 'development'
    });
});

// Cadastro
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

        res.json({
            mensagem: 'Usuário cadastrado com sucesso!',
            token: token,
            usuario: usuario
        });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Login
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

// ============================================================
//  ROTA PARA LISTAR USUÁRIOS (responsáveis)
// ============================================================

app.get('/api/usuarios', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;

    db.all(
        'SELECT id, nome, email FROM usuarios ORDER BY nome',
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ erro: 'Erro ao buscar usuários' });
                return;
            }
            res.json(rows);
        }
    );
});

// ============================================================
//  ROTAS PROTEGIDAS (TAREFAS)
// ============================================================

// Buscar todas as tarefas do usuário
app.get('/api/tarefas', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;

    db.all(
        `SELECT t.*, 
                u.nome as responsavel_nome, 
                u.email as responsavel_email 
         FROM tarefas t
         LEFT JOIN usuarios u ON t.responsavel_id = u.id
         WHERE t.usuario_id = ? 
         ORDER BY t.data_criacao DESC`,
        [usuarioId],
        (err, tarefas) => {
            if (err) {
                res.status(500).json({ erro: 'Erro ao buscar tarefas' });
                return;
            }

            if (tarefas.length === 0) {
                res.json([]);
                return;
            }

            let completas = 0;
            tarefas.forEach((tarefa, index) => {
                db.all(
                    'SELECT * FROM subtarefas WHERE tarefa_id = ?',
                    [tarefa.id],
                    (err, subtarefas) => {
                        tarefa.subtarefas = subtarefas || [];
                        completas++;

                        if (completas === tarefas.length) {
                            res.json(tarefas);
                        }
                    }
                );
            });
        }
    );
});

// Criar nova tarefa
app.post('/api/tarefas', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;
    const { titulo, tag, subtarefas, responsavel_id } = req.body;

    if (!titulo) {
        return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    db.run(
        'INSERT INTO tarefas (usuario_id, titulo, tag, status, responsavel_id) VALUES (?, ?, ?, ?, ?)',
        [usuarioId, titulo, tag || '', 'todo', responsavel_id || null],
        function (err) {
            if (err) {
                res.status(500).json({ erro: 'Erro ao criar tarefa' });
                return;
            }

            const tarefaId = this.lastID;

            if (subtarefas && subtarefas.length > 0) {
                let inseridas = 0;
                subtarefas.forEach(sub => {
                    db.run(
                        'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                        [tarefaId, sub.texto, sub.concluida || 0],
                        (err) => {
                            inseridas++;
                            if (inseridas === subtarefas.length) {
                                res.json({
                                    id: tarefaId,
                                    mensagem: 'Tarefa criada com sucesso!'
                                });
                            }
                        }
                    );
                });
            } else {
                res.json({
                    id: tarefaId,
                    mensagem: 'Tarefa criada com sucesso!'
                });
            }
        }
    );
});

// Atualizar tarefa
app.put('/api/tarefas/:id', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;
    const tarefaId = req.params.id;
    const { titulo, tag, subtarefas, responsavel_id } = req.body;

    db.get(
        'SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?',
        [tarefaId, usuarioId],
        (err, tarefa) => {
            if (err || !tarefa) {
                return res.status(404).json({ erro: 'Tarefa não encontrada' });
            }

            db.run(
                'UPDATE tarefas SET titulo = ?, tag = ?, responsavel_id = ? WHERE id = ?',
                [titulo, tag || '', responsavel_id || null, tarefaId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
                    }

                    db.run('DELETE FROM subtarefas WHERE tarefa_id = ?', [tarefaId], (err) => {
                        if (err) {
                            return res.status(500).json({ erro: 'Erro ao atualizar subtarefas' });
                        }

                        if (subtarefas && subtarefas.length > 0) {
                            let inseridas = 0;
                            subtarefas.forEach(sub => {
                                db.run(
                                    'INSERT INTO subtarefas (tarefa_id, texto, concluida) VALUES (?, ?, ?)',
                                    [tarefaId, sub.texto, sub.concluida || 0],
                                    (err) => {
                                        inseridas++;
                                        if (inseridas === subtarefas.length) {
                                            res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
                                        }
                                    }
                                );
                            });
                        } else {
                            res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
                        }
                    });
                }
            );
        }
    );
});

// Atualizar status da tarefa
app.patch('/api/tarefas/:id/status', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;
    const tarefaId = req.params.id;
    const { status } = req.body;

    db.get(
        'SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?',
        [tarefaId, usuarioId],
        (err, tarefa) => {
            if (err || !tarefa) {
                return res.status(404).json({ erro: 'Tarefa não encontrada' });
            }

            db.run(
                'UPDATE tarefas SET status = ? WHERE id = ?',
                [status, tarefaId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ erro: 'Erro ao atualizar status' });
                    }
                    res.json({ mensagem: 'Status atualizado com sucesso!' });
                }
            );
        }
    );
});

// Alternar subtarefa
app.patch('/api/subtarefas/:id', auth.autenticar, (req, res) => {
    const subtarefaId = req.params.id;
    const { concluida } = req.body;

    db.get(
        `SELECT s.id FROM subtarefas s
         JOIN tarefas t ON s.tarefa_id = t.id
         WHERE s.id = ? AND t.usuario_id = ?`,
        [subtarefaId, req.usuarioId],
        (err, subtarefa) => {
            if (err || !subtarefa) {
                return res.status(404).json({ erro: 'Subtarefa não encontrada' });
            }

            db.run(
                'UPDATE subtarefas SET concluida = ? WHERE id = ?',
                [concluida ? 1 : 0, subtarefaId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ erro: 'Erro ao atualizar subtarefa' });
                    }
                    res.json({ mensagem: 'Subtarefa atualizada!' });
                }
            );
        }
    );
});

// Deletar tarefa
app.delete('/api/tarefas/:id', auth.autenticar, (req, res) => {
    const usuarioId = req.usuarioId;
    const tarefaId = req.params.id;

    db.get(
        'SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?',
        [tarefaId, usuarioId],
        (err, tarefa) => {
            if (err || !tarefa) {
                return res.status(404).json({ erro: 'Tarefa não encontrada' });
            }

            db.run('DELETE FROM tarefas WHERE id = ?', [tarefaId], (err) => {
                if (err) {
                    return res.status(500).json({ erro: 'Erro ao deletar tarefa' });
                }
                res.json({ mensagem: 'Tarefa deletada com sucesso!' });
            });
        }
    );
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
//  Escuta em todas as interfaces (0.0.0.0) e usa porta dinâmica
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API disponível em http://localhost:${PORT}/api/health`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 JWT Secret: ${process.env.JWT_SECRET ? '✅ Configurada' : '⚠️ Usando padrão'}`);
});

console.log('✅ Servidor iniciado com sucesso!');