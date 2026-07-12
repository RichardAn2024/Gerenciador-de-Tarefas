// server.js - VERSÃO MÍNIMA PARA TESTE
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Rota de teste
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 Volmanday está ONLINE!</h1>
        <p>Servidor rodando na porta ${PORT}</p>
        <p><a href="/api/health">Testar API</a></p>
    `);
});

// Rota da API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mensagem: 'Servidor funcionando!',
        porta: PORT,
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📋 Health: /api/health`);
});