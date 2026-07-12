// admin.js - Lógica da página de administração com sistema de aprovação

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

    document.getElementById('adminName').textContent = `👑 ${usuario.nome}`;

    await carregarEstatisticas();
    await carregarUsuarios();

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
            tbody.innerHTML = '<tr><td colspan="8" class="empty-text">Nenhum usuário cadastrado</td></tr>';
            return;
        }

        usuarios.forEach(usuario => {
            const tr = document.createElement('tr');

            const dataCriacao = usuario.criado_em ? formatarDataAdmin(usuario.criado_em) : '-';

            // Status com cores
            let statusHtml = '';
            if (usuario.status === 'pendente') {
                statusHtml = '<span class="badge badge-pendente" style="background: #ff9800; color: white;">⏳ Pendente</span>';
            } else if (usuario.status === 'aprovado') {
                statusHtml = '<span class="badge badge-aprovado" style="background: #4CAF50; color: white;">✅ Aprovado</span>';
            } else if (usuario.status === 'rejeitado') {
                statusHtml = '<span class="badge badge-rejeitado" style="background: #f44336; color: white;">❌ Rejeitado</span>';
            } else {
                statusHtml = '<span class="badge badge-aprovado" style="background: #4CAF50; color: white;">✅ Aprovado</span>';
            }

            // Ações
            let acoesHtml = '';
            if (usuario.is_admin) {
                acoesHtml = '<span class="badge badge-admin">👑 Admin</span>';
            } else if (usuario.status === 'pendente') {
                acoesHtml = `
                    <button class="btn btn-success btn-sm" onclick="aprovarUsuario(${usuario.id})">✅ Aprovar</button>
                    <button class="btn btn-danger btn-sm" onclick="rejeitarUsuario(${usuario.id})">❌ Rejeitar</button>
                `;
            } else {
                acoesHtml = `
                    <button class="btn btn-danger btn-sm" onclick="confirmarExclusaoUsuario(${usuario.id}, '${usuario.nome}')">🗑️</button>
                `;
            }

            tr.innerHTML = `
                <td>#${usuario.id}</td>
                <td><strong>${usuario.nome}</strong></td>
                <td>${usuario.email}</td>
                <td><span class="badge badge-tarefas">${usuario.total_tarefas || 0}</span></td>
                <td>${usuario.is_admin ? '✅ Sim' : '❌ Não'}</td>
                <td>${statusHtml}</td>
                <td>${dataCriacao}</td>
                <td>${acoesHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        document.getElementById('usuariosList').innerHTML = '<tr><td colspan="8" class="error-text">Erro ao carregar usuários</td></tr>';
    }
}

// ============================================================
//  APROVAR USUÁRIO
// ============================================================

async function aprovarUsuario(id) {
    try {
        const response = await apiRequest(`/admin/usuarios/${id}/aprovar`, {
            method: 'PATCH'
        });

        if (response.ok) {
            await carregarUsuarios();
            await carregarEstatisticas();
            alert('✅ Usuário aprovado com sucesso!');
        } else {
            const data = await response.json();
            alert(data.erro || 'Erro ao aprovar usuário');
        }
    } catch (error) {
        alert('Erro ao aprovar usuário: ' + error.message);
    }
}

// ============================================================
//  REJEITAR USUÁRIO
// ============================================================

async function rejeitarUsuario(id) {
    try {
        const response = await apiRequest(`/admin/usuarios/${id}/rejeitar`, {
            method: 'PATCH'
        });

        if (response.ok) {
            await carregarUsuarios();
            await carregarEstatisticas();
            alert('❌ Usuário rejeitado!');
        } else {
            const data = await response.json();
            alert(data.erro || 'Erro ao rejeitar usuário');
        }
    } catch (error) {
        alert('Erro ao rejeitar usuário: ' + error.message);
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
    document.getElementById('cancelConfirmBtn').addEventListener('click', fecharModalConfirmacao);
    document.getElementById('closeConfirmBtn').addEventListener('click', fecharModalConfirmacao);
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) fecharModalConfirmacao();
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja sair?')) {
            logout();
        }
    });

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
window.aprovarUsuario = aprovarUsuario;
window.rejeitarUsuario = rejeitarUsuario;