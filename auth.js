// auth.js - Frontend com suporte a aprovação

// ============================================================
//  CONFIGURAÇÃO DA API
// ============================================================

// Detecta automaticamente se está em produção ou desenvolvimento
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

console.log(`🔗 Conectando ao servidor: ${API_URL}`);

// ============================================================
//  FUNÇÕES DE AUTENTICAÇÃO
// ============================================================

function mostrarErro(mensagem) {
    const erroEl = document.getElementById('mensagemErro');
    if (erroEl) {
        erroEl.textContent = mensagem;
        erroEl.style.display = 'block';
    } else {
        alert(mensagem);
    }
}

function ocultarErro() {
    const erroEl = document.getElementById('mensagemErro');
    if (erroEl) {
        erroEl.style.display = 'none';
    }
}

// ============================================================
//  CADASTRO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cadastroForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            ocultarErro();

            const nome = document.getElementById('cadastroNome').value.trim();
            const email = document.getElementById('cadastroEmail').value.trim();
            const senha = document.getElementById('cadastroSenha').value;
            const confirmarSenha = document.getElementById('cadastroConfirmarSenha').value;

            if (senha !== confirmarSenha) {
                mostrarErro('As senhas não coincidem.');
                return;
            }

            if (senha.length < 6) {
                mostrarErro('A senha deve ter pelo menos 6 caracteres.');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/cadastro`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, email, senha })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('📝 Cadastro realizado com sucesso! Aguarde a aprovação do administrador.');
                    window.location.href = 'login.html';
                } else {
                    mostrarErro(data.erro || 'Erro ao cadastrar.');
                }
            } catch (error) {
                console.error('❌ Erro no cadastro:', error);
                mostrarErro('Erro de conexão com o servidor.');
            }
        });
    }
});

// ============================================================
//  LOGIN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            ocultarErro();

            const email = document.getElementById('loginEmail').value.trim();
            const senha = document.getElementById('loginPassword').value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('usuario', JSON.stringify(data.usuario));
                    window.location.href = 'index.html';
                } else {
                    // Verificar se é erro de pendência
                    if (data.erro && data.erro.includes('Aguardando aprovação')) {
                        alert('📝 ' + data.erro);
                    } else if (data.erro && data.erro.includes('rejeitado')) {
                        alert('❌ ' + data.erro);
                    } else {
                        mostrarErro(data.erro || 'Email ou senha incorretos.');
                    }
                }
            } catch (error) {
                console.error('❌ Erro no login:', error);
                mostrarErro('Erro de conexão com o servidor.');
            }
        });
    }
});

// ============================================================
//  FUNÇÕES DE AUTENTICAÇÃO (GLOBAIS)
// ============================================================

function getToken() {
    return localStorage.getItem('token');
}

function getUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}

function verificarAutenticacao() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    return token;
}

// ============================================================
//  FUNÇÕES DA API (GLOBAIS)
// ============================================================

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    return response;
}

// ============================================================
//  FUNÇÕES DE TAREFAS (GLOBAIS)
// ============================================================

async function carregarTarefas() {
    const response = await apiRequest('/tarefas');
    if (!response.ok) {
        throw new Error('Erro ao carregar tarefas');
    }
    return response.json();
}

async function carregarTarefasAssistencia() {
    const response = await apiRequest('/tarefas/assistencia');
    if (!response.ok) {
        throw new Error('Erro ao carregar tarefas de assistência');
    }
    return response.json();
}

async function criarTarefa(titulo, tag, subtarefas, responsavel_id = null, prazo = null) {
    const response = await apiRequest('/tarefas', {
        method: 'POST',
        body: JSON.stringify({ titulo, tag, subtarefas, responsavel_id, prazo })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || 'Erro ao criar tarefa');
    }
    return response.json();
}

async function atualizarTarefa(id, titulo, tag, subtarefas, responsavel_id = null, prazo = null) {
    const response = await apiRequest(`/tarefas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ titulo, tag, subtarefas, responsavel_id, prazo })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || 'Erro ao atualizar tarefa');
    }
    return response.json();
}

async function atualizarStatusTarefa(id, status) {
    const response = await apiRequest(`/tarefas/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || 'Erro ao atualizar status');
    }
    return response.json();
}

async function alternarSubtarefa(id, concluida) {
    const response = await apiRequest(`/subtarefas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ concluida })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || 'Erro ao atualizar subtarefa');
    }
    return response.json();
}

async function deletarTarefa(id) {
    const response = await apiRequest(`/tarefas/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || 'Erro ao deletar tarefa');
    }
    return response.json();
}

async function listarUsuarios() {
    const response = await apiRequest('/usuarios');
    if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
    }
    return response.json();
}