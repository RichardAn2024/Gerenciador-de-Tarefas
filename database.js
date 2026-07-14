// database.js - Configuração MySQL com nova tabela tarefa_responsaveis
const mysql = require('mysql2');
require('dotenv').config();

console.log('📁 Configuração do Banco:');

// Configuração para Railway MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

console.log(`   Host: ${dbConfig.host}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   SSL: ${dbConfig.ssl ? 'Ativado' : 'Desativado'}`);

const pool = mysql.createPool(dbConfig);
const db = pool.promise();

// ============================================================
//  INICIALIZAR TABELAS
// ============================================================

async function inicializarBanco() {
    try {
        console.log('🔄 Inicializando banco de dados...');

        // Testar conexão
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
                status VARCHAR(20) DEFAULT 'aprovado',
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
                prazo DATE NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
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

        // 4. NOVA TABELA: Responsáveis das tarefas (N:N)
        await db.query(`
            CREATE TABLE IF NOT EXISTS tarefa_responsaveis (
                id INT PRIMARY KEY AUTO_INCREMENT,
                tarefa_id INT NOT NULL,
                usuario_id INT NOT NULL,
                FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                UNIQUE KEY unique_responsavel (tarefa_id, usuario_id)
            )
        `);
        console.log('✅ Tabela tarefa_responsaveis criada/verificada');

        // 5. Verificar/Criar admin padrão
        const [rows] = await db.query('SELECT * FROM usuarios WHERE is_admin = 1 LIMIT 1');

        if (rows.length === 0) {
            const bcrypt = require('bcryptjs');
            const salt = bcrypt.genSaltSync(10);
            const senhaHash = bcrypt.hashSync('admin123', salt);

            await db.query(
                'INSERT INTO usuarios (nome, email, senha, is_admin, status) VALUES (?, ?, ?, ?, ?)',
                ['Administrador', 'admin@admin.com', senhaHash, 1, 'aprovado']
            );
            console.log('✅ Usuário admin criado!');
            console.log('   Email: admin@admin.com');
            console.log('   Senha: admin123');
        } else {
            console.log('✅ Admin já existe:', rows[0].email);
        }

        console.log('✅ Banco de dados inicializado com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar banco:', error.message);
        console.error('❌ Detalhes:', error);
        return false;
    }
}

// Inicializar
inicializarBanco().catch(err => {
    console.error('❌ Falha ao inicializar banco:', err.message);
});

module.exports = db;