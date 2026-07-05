// database.js - Configuração do banco de dados MySQL
const mysql = require('mysql2');
require('dotenv').config();

// ============================================================
//  CONFIGURAÇÃO DO BANCO DE DADOS MYSQL
// ============================================================

// Criar pool de conexões (mais eficiente que conexão única)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mini_monday',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promise wrapper para usar async/await
const db = pool.promise();

console.log(`📁 Conectando ao MySQL: ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'mini_monday'}`);

// ============================================================
//  INICIALIZAR TABELAS
// ============================================================

async function inicializarBanco() {
    try {
        // 1. Tabela de usuários
        await db.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                is_admin TINYINT DEFAULT 0,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela usuarios criada/verificada');

        // 2. Tabela de tarefas
        await db.query(`
            CREATE TABLE IF NOT EXISTS tarefas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                status ENUM('todo', 'doing', 'done') DEFAULT 'todo',
                tag VARCHAR(50),
                responsavel_id INT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Tabela tarefas criada/verificada');

        // 3. Tabela de subtarefas
        await db.query(`
            CREATE TABLE IF NOT EXISTS subtarefas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                tarefa_id INT NOT NULL,
                texto TEXT NOT NULL,
                concluida TINYINT DEFAULT 0,
                FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela subtarefas criada/verificada');

        // 4. Verificar/Criar admin padrão
        const [rows] = await db.query('SELECT * FROM usuarios WHERE is_admin = 1 LIMIT 1');

        if (rows.length === 0) {
            const bcrypt = require('bcryptjs');
            const salt = bcrypt.genSaltSync(10);
            const senhaHash = bcrypt.hashSync('admin123', salt);

            await db.query(
                'INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, ?)',
                ['Administrador', 'admin@admin.com', senhaHash, 1]
            );
            console.log('✅ Usuário admin criado!');
            console.log('   Email: admin@admin.com');
            console.log('   Senha: admin123');
        } else {
            console.log('✅ Admin já existe:', rows[0].email);
        }

        console.log('✅ Banco de dados MySQL inicializado!');
    } catch (error) {
        console.error('❌ Erro ao inicializar banco:', error);
        throw error;
    }
}

// Inicializar banco
inicializarBanco();

module.exports = db;