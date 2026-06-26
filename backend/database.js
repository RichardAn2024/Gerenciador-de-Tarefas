// database.js - Configuração do banco de dados SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// ============================================================
//  CONFIGURAÇÃO DO BANCO DE DADOS PARA PRODUÇÃO
// ============================================================

// Usar caminho absoluto para o banco de dados
const dbPath = path.join(__dirname, 'database.sqlite');
console.log(`📁 Banco de dados em: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// Criar tabelas se não existirem
db.serialize(() => {
    // Tabela de usuários (com coluna is_admin)
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, function (err) {
        if (err) {
            console.error('❌ Erro ao criar tabela usuarios:', err);
            return;
        }
        console.log('✅ Tabela usuarios criada/verificada');

        // Verificar se já existe um admin
        db.get('SELECT * FROM usuarios WHERE is_admin = 1', [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao verificar admin:', err);
                return;
            }

            if (!row) {
                // Criar admin padrão
                const salt = bcrypt.genSaltSync(10);
                const senhaHash = bcrypt.hashSync('admin123', salt);
                db.run(
                    'INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, ?)',
                    ['Administrador', 'admin@admin.com', senhaHash, 1],
                    function (err) {
                        if (err) {
                            console.error('❌ Erro ao criar admin:', err);
                            return;
                        }
                        console.log('✅ Usuário admin criado!');
                        console.log('   Email: admin@admin.com');
                        console.log('   Senha: admin123');
                    }
                );
            } else {
                console.log('✅ Admin já existe:', row.email);
            }
        });
    });

    // Tabela de tarefas (COM coluna responsavel_id)
    db.run(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            status TEXT DEFAULT 'todo',
            tag TEXT,
            responsavel_id INTEGER,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (responsavel_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    `, (err) => {
        if (!err) console.log('✅ Tabela tarefas criada/verificada');
    });

    // Tabela de subtarefas
    db.run(`
        CREATE TABLE IF NOT EXISTS subtarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tarefa_id INTEGER NOT NULL,
            texto TEXT NOT NULL,
            concluida INTEGER DEFAULT 0,
            FOREIGN KEY (tarefa_id) REFERENCES tarefas (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (!err) console.log('✅ Tabela subtarefas criada/verificada');
    });

    console.log('✅ Banco de dados inicializado!');
});

module.exports = db;