// server.js - Servidor principal (VERSÃO HOSTINGER - CORREÇÃO FINAL)
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
//  CAMINHO FIXO PARA O FRONTEND - HOSTINGER
// ============================================================

// 🔥 CAMINHO CORRETO: frontend dentro de nodejs
const frontendPath = path.join(__dirname, 'frontend');
console.log(`📂 Servindo frontend de: ${frontendPath}`);

// Verificar se a pasta existe
if (!fs.existsSync(frontendPath)) {
    console.error(`❌ Pasta frontend não encontrada em: ${frontendPath}`);
    console.log('📂 Conteúdo da pasta atual:', fs.readdirSync(__dirname).join(', '));
}

// ============================================================
//  SERVIDOR DE ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================

// Servir arquivos estáticos da pasta frontend
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
            <p>Conteúdo da pasta frontend: ${fs.readdirSync(frontendPath).join(', ')}</p>
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
        cwd: __dirname,
        frontendFiles: fs.existsSync(frontendPath) ? fs.readdirSync(frontendPath) : 'Pasta não encontrada'
    });
});

// ... (Mantenha TODAS as outras rotas: cadastro, login, tarefas, admin, etc.)
// ... (O código das rotas permanece exatamente igual ao seu arquivo atual)

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API disponível em https://richardangelo.net/api/health`);
    console.log(`🌐 Ambiente: ${NODE_ENV}`);
    console.log(`📂 Servindo frontend de: ${frontendPath}`);
    console.log(`📄 Index.html existe: ${fs.existsSync(path.join(frontendPath, 'index.html'))}`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promessa rejeitada:', err);
});

console.log('✅ Servidor iniciado com sucesso!');