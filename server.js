// server.js - Versão COMPLETA com todas as rotas
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

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

// ============================================================
//  SERVIR ARQUIVOS ESTÁTICOS (HTML, CSS, JS)
// ============================================================

// Servir todos os arquivos da raiz
app.use(express.static(__dirname));

// ============================================================
//  ROTAS DA API
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Volmanday Server rodando no Railway!',
        porta: PORT,
        timestamp: new Date().toISOString()
    });
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
//  FALLBACK - 404
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        erro: 'Rota não encontrada',
        mensagem: 'Volmanday API - Verifique a URL',
        rotas_disponiveis: [
            '/',
            '/login.html',
            '/cadastro.html',
            '/admin.html',
            '/assistencia.html',
            '/api/health'
        ]
    });
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Volmanday Server rodando na porta ${PORT}`);
    console.log(`📋 API Health: /api/health`);
    console.log(`🌐 Acesse: https://gerenciador-de-tarefas-production-4637.up.railway.app`);
});