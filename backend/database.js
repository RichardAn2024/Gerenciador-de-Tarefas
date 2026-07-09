// database.js - Configuração do banco de dados MySQL
const mysql = require('mysql2');
require('dotenv').config();

// ============================================================
//  CONFIGURAÇÃO DO BANCO DE DADOS MYSQL
// ============================================================

// Verificar se as variáveis de ambiente existem
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mini_monday',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log('📁 Configuração do Banco:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);

// Criar pool de conexões
const pool = mysql.createPool(dbConfig);

// Promise wrapper para usar async/await
const db = pool.promise();

// ============================================================
//  INICIALIZAR TABELAS
// ============================================================

async function inicializarBanco() {
    try {
        console.log('🔄 Inicializando banco de dados...');

        // Testar conexão primeiro
        const [testResult] = await db.query('SELECT 1+1 as result');
        console.log('✅ Conexão com banco estabelecida!');

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

        console.log('✅ Banco de dados MySQL inicializado com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar banco:', error.message);
        console.error('❌ Detalhes:', error);
        // Não derrubar o servidor, apenas logar o erro
        return false;
    }
}

// Inicializar banco (sem bloquear o servidor)
inicializarBanco().catch(err => {
    console.error('❌ Falha ao inicializar banco:', err.message);
});

module.exports = db;