// db.js - Conexão com Supabase
const { createClient } = require('@supabase/supabase-js');

// Criar cliente Supabase com as variáveis de ambiente
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_API_KEY
);

// Testar a conexão (opcional, mas útil para debug)
supabase
    .from('usuarios')  // ← Mude para 'usuarios' (sua tabela principal)
    .select('*')
    .limit(1)
    .then(({ data, error }) => {
        if (error) {
            console.error('❌ Erro de conexão:', error);
        } else {
            console.log('✅ Conectado ao Supabase!');
            if (data && data.length > 0) {
                console.log('📊 Dados encontrados:', data);
            } else {
                console.log('📊 Nenhum dado encontrado na tabela "usuarios"');
            }
        }
    });

module.exports = supabase;