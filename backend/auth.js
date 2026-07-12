// auth.js - Autenticação
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'volmanday-secret-key-change-in-production';

console.log('🔐 Auth inicializado');

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

function adminApenas(req, res, next) {
    if (req.isAdmin !== 1) {
        return res.status(403).json({ erro: 'Acesso negado. Apenas administradores podem acessar.' });
    }
    next();
}

async function cadastrarUsuario(nome, email, senha) {
    try {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);

        if (rows.length > 0) {
            throw new Error('Email já cadastrado');
        }

        const salt = bcrypt.genSaltSync(10);
        const senhaHash = bcrypt.hashSync(senha, salt);

        const [result] = await db.query(
            'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
            [nome, email, senhaHash]
        );

        return {
            id: result.insertId,
            nome: nome,
            email: email,
            isAdmin: 0
        };
    } catch (error) {
        throw error;
    }
}

async function loginUsuario(email, senha) {
    try {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (rows.length === 0) {
            throw new Error('Email ou senha incorretos');
        }

        const usuario = rows[0];
        const senhaValida = bcrypt.compareSync(senha, usuario.senha);

        if (!senhaValida) {
            throw new Error('Email ou senha incorretos');
        }

        const token = gerarToken(usuario.id, usuario.email, usuario.is_admin);

        return {
            token: token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                isAdmin: usuario.is_admin || 0
            }
        };
    } catch (error) {
        throw error;
    }
}

async function listarUsuarios() {
    try {
        const [rows] = await db.query(`
            SELECT id, nome, email, is_admin, criado_em,
                   (SELECT COUNT(*) FROM tarefas WHERE usuario_id = usuarios.id) as total_tarefas
            FROM usuarios
            ORDER BY criado_em DESC
        `);
        return rows;
    } catch (error) {
        throw error;
    }
}

async function deletarUsuario(id) {
    try {
        const [rows] = await db.query('SELECT is_admin FROM usuarios WHERE id = ?', [id]);

        if (rows.length > 0 && rows[0].is_admin === 1) {
            throw new Error('Não é possível deletar o administrador principal');
        }

        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        return { deletado: true, id: id };
    } catch (error) {
        throw error;
    }
}

async function obterEstatisticas() {
    try {
        const [rows] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM usuarios) as total_usuarios,
                (SELECT COUNT(*) FROM tarefas) as total_tarefas,
                (SELECT COUNT(*) FROM subtarefas) as total_subtarefas,
                (SELECT COUNT(*) FROM tarefas WHERE status = 'done') as tarefas_concluidas,
                (SELECT COUNT(*) FROM subtarefas WHERE concluida = 1) as subtarefas_concluidas
        `);
        return rows[0];
    } catch (error) {
        throw error;
    }
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