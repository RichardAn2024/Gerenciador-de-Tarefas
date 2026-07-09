// server.js - Servidor principal (VERSÃO HOSTINGER)
const express = require('express');
const cors = require('cors');
const path = require('path');
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
//  SERVIDOR DE ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================

// Serve os arquivos do frontend (HTML, CSS, JS)
// IMPORTANTE: Ajuste o caminho se sua estrutura for diferente
const frontendPath = path.join(__dirname, '../frontend');
console.log(`📂 Servindo frontend de: ${frontendPath}`);

app.use(express.static(frontendPath));

// Rota para a página inicial (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Rota para login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Rota para cadastro
app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'cadastro.html'));
});

// Rota para admin
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'admin.html'));
});

// ============================================================
//  ROTAS PÚBLICAS DA API
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Servidor rodando!',
        ambiente: NODE_ENV,
        jwt_configurado: JWT_SECRET !== 'fallback-secret-nao-use-em-producao'
    });
});

// (Mantenha aqui TODAS as outras rotas da sua API: cadastro, login, tarefas, admin, etc.)
// ... (código das rotas permanece igual) ...

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 API disponível em https://richardangelo.net/backend/api/health`);
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