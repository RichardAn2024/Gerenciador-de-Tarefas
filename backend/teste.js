const mysql = require('mysql2');
require('dotenv').config();

console.log('🔍 Testando conexão...');
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);
console.log('Password:', process.env.DB_PASSWORD ? '***' : '(vazio)');
console.log('Database:', process.env.DB_NAME);

const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

conn.connect((err) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        console.log('🔧 Senha usada:', process.env.DB_PASSWORD);
    } else {
        console.log('✅ Conectado com sucesso!');
        conn.end();
    }
});