// auth.js - Funções de autenticação
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
require('dotenv').config();

// ============================================================
//  CHAVE SECRETA DO JWT (vinda de variável de ambiente)
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'minha-chave-secreta-super-segura-mude-para-producao';

// ============================================================
//  FUNÇÕES DE AUTENTICAÇÃO
// ============================================================

function gerarToken(usuarioId, email, isAdmin = 0) {
    return jwt.sign(
        { id: usuarioId, email: email, isAdmin: isAdmin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verificarToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Middleware para verificar token
function autenticar(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const decoded = verificarToken(token);
    if (!decoded) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }

    req.usuarioId = decoded.id;
    req.usuarioEmail = decoded.email;
    req.isAdmin = decoded.isAdmin || 0;
    next();
}

// Middleware para verificar se é admin
function adminApenas(req, res, next) {
    if (req.isAdmin !== 1) {
        return res.status(403).json({ erro: 'Acesso negado. Apenas administradores podem acessar.' });
    }
    next();
}

// ============================================================
//  FUNÇÕES DE USUÁRIO
// ============================================================

function cadastrarUsuario(nome, email, senha) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row) {
                reject(new Error('Email já cadastrado'));
                return;
            }

            const salt = bcrypt.genSaltSync(10);
            const senhaHash = bcrypt.hashSync(senha, salt);

            db.run(
                'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
                [nome, email, senhaHash],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({
                        id: this.lastID,
                        nome: nome,
                        email: email,
                        isAdmin: 0
                    });
                }
            );
        });
    });
}

function loginUsuario(email, senha) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, usuario) => {
            if (err) {
                reject(err);
                return;
            }
            if (!usuario) {
                reject(new Error('Email ou senha incorretos'));
                return;
            }

            const senhaValida = bcrypt.compareSync(senha, usuario.senha);
            if (!senhaValida) {
                reject(new Error('Email ou senha incorretos'));
                return;
            }

            const token = gerarToken(usuario.id, usuario.email, usuario.is_admin);
            resolve({
                token: token,
                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    isAdmin: usuario.is_admin || 0
                }
            });
        });
    });
}

// ============================================================
//  FUNÇÕES DE ADMIN
// ============================================================

function listarUsuarios() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, nome, email, is_admin, criado_em,
                    (SELECT COUNT(*) FROM tarefas WHERE usuario_id = usuarios.id) as total_tarefas
             FROM usuarios
             ORDER BY criado_em DESC`,
            [],
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            }
        );
    });
}

function deletarUsuario(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT is_admin FROM usuarios WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row && row.is_admin === 1) {
                reject(new Error('Não é possível deletar o administrador principal'));
                return;
            }

            db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ deletado: true, id: id });
            });
        });
    });
}

function obterEstatisticas() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                (SELECT COUNT(*) FROM usuarios) as total_usuarios,
                (SELECT COUNT(*) FROM tarefas) as total_tarefas,
                (SELECT COUNT(*) FROM subtarefas) as total_subtarefas,
                (SELECT COUNT(*) FROM tarefas WHERE status = 'done') as tarefas_concluidas,
                (SELECT COUNT(*) FROM subtarefas WHERE concluida = 1) as subtarefas_concluidas
            `,
            [],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            }
        );
    });
}

module.exports = {
    autenticar,
    adminApenas,
    cadastrarUsuario,
    loginUsuario,
    gerarToken,
    verificarToken,
    listarUsuarios,
    deletarUsuario,
    obterEstatisticas
};