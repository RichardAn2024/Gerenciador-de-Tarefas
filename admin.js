// admin.js - Lógica da página de administração

// ============================================================
//  VERIFICAR AUTENTICAÇÃO E PERMISSÃO
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const token = verificarAutenticacao();
    if (!token) return;

    const usuario = getUsuario();
    if (!usuario || !usuario.isAdmin) {
        alert('Acesso negado. Apenas administradores podem acessar esta página.');
        window.location.href = 'index.html';
        return;
    }

    // Mostrar nome do admin
    document.getElementById('adminName').textContent = `👑 ${usuario.nome}`;

    // Carregar dados
    await carregarEstatisticas();
    await carregarUsuarios();

    // Configurar eventos
    configurarEventosAdmin();
});

// ============================================================
//  CARREGAR ESTATÍSTICAS
// ============================================================

async function carregarEstatisticas() {
    try {
        const response = await apiRequest('/admin/estatisticas');
        const data = await response.json();

        document.getElementById('totalUsuarios').textContent = data.total_usuarios || 0;
        document.getElementById('totalTarefasAdmin').textContent = data.total_tarefas || 0;
        document.getElementById('totalSubtarefasAdmin').textContent = data.total_subtarefas || 0;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// ============================================================
//  CARREGAR USUÁRIOS
// ============================================================

async function carregarUsuarios() {
    try {
        const response = await apiRequest('/admin/usuarios');
        const usuarios = await response.json();

        const tbody = document.getElementById('usuariosList');
        tbody.innerHTML = '';

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-text">Nenhum usuário cadastrado</td></tr>';
            return;
        }

        usuarios.forEach(usuario => {
            const tr = document.createElement('tr');

            const dataCriacao = usuario.criado_em ? formatarDataAdmin(usuario.criado_em) : '-';

            tr.innerHTML = `
                <td>#${usuario.id}</td>
                <td><strong>${usuario.nome}</strong></td>
                <td>${usuario.email}</td>
                <td><span class="badge badge-tarefas">${usuario.total_tarefas || 0}</span></td>
                <td>${usuario.is_admin ? '✅ Sim' : '❌ Não'}</td>
                <td>${dataCriacao}</td>
                <td>
                    ${usuario.is_admin ?
                    '<span class="badge badge-admin">Admin</span>' :
                    `<button class="btn btn-danger btn-sm" onclick="confirmarExclusaoUsuario(${usuario.id}, '${usuario.nome}')">🗑️</button>`
                }
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        document.getElementById('usuariosList').innerHTML = '<tr><td colspan="7" class="error-text">Erro ao carregar usuários</td></tr>';
    }
}

// ============================================================
//  EXCLUIR USUÁRIO
// ============================================================

let pendingDeleteUserId = null;

function confirmarExclusaoUsuario(id, nome) {
    pendingDeleteUserId = id;
    document.getElementById('confirmTitle').textContent = '🗑️ Excluir Usuário';
    document.getElementById('confirmMessage').textContent = `Tem certeza que deseja excluir o usuário "${nome}" permanentemente? Todas as suas tarefas também serão excluídas.`;
    document.getElementById('confirmModal').classList.add('active');

    document.getElementById('confirmActionBtn').onclick = async () => {
        await executarExclusaoUsuario();
    };
}

async function executarExclusaoUsuario() {
    if (pendingDeleteUserId === null) return;

    try {
        const response = await apiRequest(`/admin/usuarios/${pendingDeleteUserId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await carregarUsuarios();
            await carregarEstatisticas();
            fecharModalConfirmacao();
        } else {
            const data = await response.json();
            alert(data.erro || 'Erro ao excluir usuário');
        }
    } catch (error) {
        alert('Erro ao excluir usuário: ' + error.message);
    }
}

// ============================================================
//  FUNÇÕES AUXILIARES
// ============================================================

function formatarDataAdmin(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

function fecharModalConfirmacao() {
    document.getElementById('confirmModal').classList.remove('active');
    pendingDeleteUserId = null;
}

// ============================================================
//  CONFIGURAR EVENTOS
// ============================================================

function configurarEventosAdmin() {
    // Fechar modal
    document.getElementById('cancelConfirmBtn').addEventListener('click', fecharModalConfirmacao);
    document.getElementById('closeConfirmBtn').addEventListener('click', fecharModalConfirmacao);
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) fecharModalConfirmacao();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja sair?')) {
            logout();
        }
    });

    // ESC para fechar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            fecharModalConfirmacao();
        }
    });
}

// ============================================================
//  EXPORTAR FUNÇÕES
// ============================================================

window.confirmarExclusaoUsuario = confirmarExclusaoUsuario;