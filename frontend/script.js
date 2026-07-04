/* ============================================================
   script.js - Lógica completa do Dashboard (COM RESPONSÁVEIS E CRIADOR)
   ============================================================ */

// --- Estado ---
let tarefas = [];
let currentFilter = 'all';
let editingTaskId = null;
let usuariosDisponiveis = [];
let usuarioLogado = null;

// --- Referências DOM ---
const openCreateBtn = document.getElementById('openCreateBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const adminLink = document.getElementById('adminLink');

// --- Modal de Criação ---
const createModal = document.getElementById('createModal');
const createTitle = document.getElementById('createTitle');
const createTag = document.getElementById('createTag');
const createResponsavel = document.getElementById('createResponsavel');
const subtaskList = document.getElementById('subtaskList');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const saveCreateBtn = document.getElementById('saveCreateBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const closeCreateModalBtn = document.getElementById('closeCreateModalBtn');

// --- Modal de Edição ---
const editModal = document.getElementById('editModal');
const editTitle = document.getElementById('editTitle');
const editTag = document.getElementById('editTag');
const editResponsavel = document.getElementById('editResponsavel');
const editSubtaskList = document.getElementById('editSubtaskList');
const addEditSubtaskBtn = document.getElementById('addEditSubtaskBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- Modal de Confirmação ---
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const closeConfirmBtn = document.getElementById('closeConfirmBtn');

// --- Status ---
const statusMap = {
    todo: { listId: 'list-todo', countId: 'count-todo', label: 'A Fazer' },
    doing: { listId: 'list-doing', countId: 'count-doing', label: 'Em Andamento' },
    done: { listId: 'list-done', countId: 'count-done', label: 'Concluído' },
};

// ============================================================
//  INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    const token = verificarAutenticacao();
    if (!token) return;

    // Mostrar nome do usuário
    usuarioLogado = getUsuario();
    if (usuarioLogado) {
        userName.textContent = `👤 ${usuarioLogado.nome}`;

        // Verificar se é admin e mostrar o link
        if (usuarioLogado.isAdmin) {
            adminLink.style.display = 'inline-flex';
        }
    }

    // Carregar usuários para o select de responsáveis
    await carregarUsuarios();

    // Carregar tarefas
    await carregarTarefasDoServidor();

    // Configurar eventos
    configurarEventos();
});

// ============================================================
//  CARREGAR USUÁRIOS (RESPONSÁVEIS) - INCLUI O PRÓPRIO USUÁRIO
// ============================================================

async function carregarUsuarios() {
    try {
        usuariosDisponiveis = await listarUsuarios();
        popularSelectResponsaveis(createResponsavel);
        popularSelectResponsaveis(editResponsavel);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

function popularSelectResponsaveis(select) {
    if (!select) return;

    // Limpar opções existentes (manter a primeira opção)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // ===== ADICIONAR O PRÓPRIO USUÁRIO PRIMEIRO =====
    if (usuarioLogado) {
        const optionEu = document.createElement('option');
        optionEu.value = usuarioLogado.id;
        optionEu.textContent = `👤 Eu (${usuarioLogado.nome})`;
        optionEu.style.fontWeight = 'bold';
        optionEu.style.color = '#0066ff';
        select.appendChild(optionEu);
    }

    // Adicionar os outros usuários
    usuariosDisponiveis.forEach(usuario => {
        // Pular se for o próprio usuário (já foi adicionado)
        if (usuarioLogado && usuario.id === usuarioLogado.id) return;

        const option = document.createElement('option');
        option.value = usuario.id;
        option.textContent = `${usuario.nome} (${usuario.email})`;
        select.appendChild(option);
    });
}

// ============================================================
//  CARREGAR TAREFAS
// ============================================================

async function carregarTarefasDoServidor() {
    try {
        tarefas = await carregarTarefas();
        render();
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        alert('Erro ao carregar tarefas. Verifique o servidor.');
    }
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================

function render() {
    // Filtrar tarefas
    let filtered = tarefas;
    if (currentFilter !== 'all') {
        filtered = tarefas.filter(t => t.status === currentFilter);
    }

    // Limpar listas
    for (const status of ['todo', 'doing', 'done']) {
        const list = document.getElementById(statusMap[status].listId);
        list.innerHTML = '';
    }

    // Preencher colunas
    for (const status of ['todo', 'doing', 'done']) {
        const list = document.getElementById(statusMap[status].listId);
        const tasksInStatus = filtered.filter(t => t.status === status);

        if (tasksInStatus.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Nenhuma tarefa aqui';
            list.appendChild(empty);
            continue;
        }

        tasksInStatus.forEach(task => {
            const card = createTaskCard(task);
            list.appendChild(card);
        });
    }

    // Atualizar contadores
    updateCounters();
    updateStats();
}

// ============================================================
//  CRIAÇÃO DO CARD
// ============================================================

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = task.id;

    const borderColors = {
        todo: '#0066ff',
        doing: '#ffa500',
        done: '#00a86b'
    };
    card.style.borderLeftColor = borderColors[task.status] || '#0066ff';

    // Título
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.titulo;
    card.appendChild(title);

    // Criador da tarefa
    if (task.criador_nome) {
        const criadorEl = document.createElement('div');
        criadorEl.className = 'task-criador';
        const isEu = usuarioLogado && task.criador_id === usuarioLogado.id;
        const icone = isEu ? '👤' : '👤';
        const texto = isEu ? `Eu (${task.criador_nome})` : task.criador_nome;
        criadorEl.innerHTML = `${icone} <strong>Criador:</strong> ${texto}`;
        if (isEu) {
            criadorEl.style.background = '#e3edff';
            criadorEl.style.border = '1px solid #0066ff';
            criadorEl.style.padding = '2px 10px';
            criadorEl.style.borderRadius = '12px';
            criadorEl.style.display = 'inline-block';
            criadorEl.style.marginBottom = '4px';
        } else {
            criadorEl.style.cssText = 'font-size: 12px; color: #6b6f76; margin-bottom: 4px;';
        }
        card.appendChild(criadorEl);
    }

    // Responsável (se tiver)
    if (task.responsavel_nome) {
        const responsavelEl = document.createElement('div');
        responsavelEl.className = 'task-responsavel';

        // Verificar se o responsável é o usuário logado
        const isEu = usuarioLogado && task.responsavel_id === usuarioLogado.id;
        const icone = isEu ? '👤' : '👤';
        const texto = isEu ? `Eu (${task.responsavel_nome})` : task.responsavel_nome;

        responsavelEl.innerHTML = `${icone} <strong>Responsável:</strong> ${texto}`;
        if (isEu) {
            responsavelEl.style.background = '#e3edff';
            responsavelEl.style.border = '1px solid #0066ff';
        }
        card.appendChild(responsavelEl);
    }

    // Data
    const dateEl = document.createElement('div');
    dateEl.className = 'task-date';
    dateEl.innerHTML = `📅 ${formatarData(task.data_criacao)}`;
    card.appendChild(dateEl);

    // Subtarefas
    const subtasksEl = document.createElement('div');
    subtasksEl.className = 'task-subtasks';
    if (task.subtarefas && task.subtarefas.length > 0) {
        const doneCount = task.subtarefas.filter(s => s.concluida).length;
        const totalCount = task.subtarefas.length;
        const countInfo = document.createElement('div');
        countInfo.style.cssText = 'font-size: 11px; color: #8c929a; margin-bottom: 4px;';
        countInfo.textContent = `📋 ${doneCount}/${totalCount} concluídas`;
        subtasksEl.appendChild(countInfo);

        task.subtarefas.forEach(subtask => {
            const item = document.createElement('div');
            item.className = 'subtask-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = subtask.concluida === 1;
            checkbox.addEventListener('change', () => {
                toggleSubtask(task.id, subtask.id);
            });

            const text = document.createElement('span');
            text.className = 'subtask-text' + (subtask.concluida ? ' done' : '');
            text.textContent = subtask.texto;

            item.appendChild(checkbox);
            item.appendChild(text);
            subtasksEl.appendChild(item);
        });
    }
    if (task.subtarefas && task.subtarefas.length > 0) {
        card.appendChild(subtasksEl);
    }

    // Meta (tags + ações)
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'task-tags';
    if (task.tag) {
        const span = document.createElement('span');
        span.className = `tag ${task.tag}`;
        const icons = {
            urgent: '🔴',
            important: '🟡',
            tranquilo: '🔵'
        };
        const tagName = task.tag === 'tranquilo' ? 'Tranquilo' : task.tag.charAt(0).toUpperCase() + task.tag.slice(1);
        span.textContent = `${icons[task.tag] || ''} ${tagName}`;
        tagsContainer.appendChild(span);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '✏️';
    editBtn.className = 'edit-btn';
    editBtn.title = 'Editar tarefa';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task.id);
    });

    const forwardBtn = document.createElement('button');
    forwardBtn.innerHTML = '➡️';
    forwardBtn.title = 'Avançar status';
    forwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTask(task.id, 1);
    });

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '⬅️';
    backBtn.title = 'Voltar status';
    backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTask(task.id, -1);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Excluir tarefa';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmarExclusao(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(backBtn);
    actions.appendChild(forwardBtn);
    actions.appendChild(deleteBtn);

    meta.appendChild(tagsContainer);
    meta.appendChild(actions);

    card.appendChild(meta);

    // Drag & Drop
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
}

// ============================================================
//  DRAG & DROP
// ============================================================

let draggedTaskId = null;

function handleDragStart(e) {
    draggedTaskId = parseInt(this.dataset.id);
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
}

document.querySelectorAll('.column').forEach(column => {
    column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        const newStatus = column.dataset.status;
        if (draggedTaskId !== null) {
            await moveTask(draggedTaskId, 0, newStatus);
        }
        draggedTaskId = null;
    });
});

// ============================================================
//  FUNÇÕES DE MANIPULAÇÃO
// ============================================================

async function moveTask(id, direction, targetStatus = null) {
    const task = tarefas.find(t => t.id === id);
    if (!task) return;

    let newStatus = targetStatus;
    if (!newStatus) {
        const statusOrder = ['todo', 'doing', 'done'];
        const currentIndex = statusOrder.indexOf(task.status);
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= statusOrder.length) return;
        newStatus = statusOrder[newIndex];
    }

    try {
        await atualizarStatusTarefa(id, newStatus);
        task.status = newStatus;
        render();
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
//  VERIFICAR E ATUALIZAR STATUS DA TAREFA (SUBTAREFAS)
// ============================================================

async function verificarEAtualizarStatusTarefa(taskId) {
    const task = tarefas.find(t => t.id === taskId);
    if (!task) return;

    if (!task.subtarefas || task.subtarefas.length === 0) return;

    const todasConcluidas = task.subtarefas.every(s => s.concluida === 1);
    const algumaConcluida = task.subtarefas.some(s => s.concluida === 1);

    let novoStatus = null;

    if (todasConcluidas) {
        novoStatus = 'done';
    } else if (algumaConcluida && task.status === 'done') {
        novoStatus = 'doing';
    } else if (!algumaConcluida && (task.status === 'done' || task.status === 'doing')) {
        novoStatus = 'todo';
    }

    if (novoStatus && novoStatus !== task.status) {
        try {
            await atualizarStatusTarefa(taskId, novoStatus);
            task.status = novoStatus;
            render();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    }
}

// ============================================================
//  ALTERNAR SUBTAREFA
// ============================================================

async function toggleSubtask(taskId, subtaskId) {
    const task = tarefas.find(t => t.id === taskId);
    if (!task) return;
    const subtask = task.subtarefas.find(s => s.id === subtaskId);
    if (!subtask) return;

    const novaConcluida = subtask.concluida ? 0 : 1;

    try {
        await alternarSubtarefa(subtaskId, novaConcluida);
        subtask.concluida = novaConcluida;
        await verificarEAtualizarStatusTarefa(taskId);
        render();
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
//  MODAL DE CRIAÇÃO
// ============================================================

function openCreateModal() {
    createTitle.value = '';
    createTag.value = '';
    createResponsavel.value = '';
    subtaskList.innerHTML = '';
    createModal.classList.add('active');
    createTitle.focus();
}

function closeCreateModal() {
    createModal.classList.remove('active');
    createTitle.value = '';
    createTag.value = '';
    createResponsavel.value = '';
    subtaskList.innerHTML = '';
}

function addSubtaskInput(container) {
    const row = document.createElement('div');
    row.className = 'subtask-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Digite a subtarefa...';
    input.className = 'subtask-input';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-subtask-btn';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
        row.remove();
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
    setTimeout(() => input.focus(), 50);
}

function getSubtasksFromContainer(container) {
    const subtasks = [];
    const rows = container.querySelectorAll('.subtask-input-row');
    rows.forEach(row => {
        const input = row.querySelector('input[type="text"]');
        const text = input.value.trim();
        if (text) {
            subtasks.push({ texto: text, concluida: 0 });
        }
    });
    return subtasks;
}

function loadSubtasksIntoContainer(container, subtasks) {
    container.innerHTML = '';
    if (subtasks && subtasks.length > 0) {
        subtasks.forEach(subtask => {
            const row = document.createElement('div');
            row.className = 'subtask-input-row';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = subtask.texto;
            input.className = 'subtask-input';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = subtask.concluida === 1;
            checkbox.style.cssText = 'width: 16px; height: 16px; accent-color: #0066ff; cursor: pointer;';
            checkbox.addEventListener('change', () => {
                input.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
                input.style.color = checkbox.checked ? '#8c929a' : '#1a1a1a';
            });
            if (subtask.concluida) {
                input.style.textDecoration = 'line-through';
                input.style.color = '#8c929a';
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-subtask-btn';
            removeBtn.textContent = '✕';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', () => {
                row.remove();
            });

            row.appendChild(checkbox);
            row.appendChild(input);
            row.appendChild(removeBtn);
            container.appendChild(row);
        });
    }
}

function getEditSubtasks() {
    const subtasks = [];
    const rows = editSubtaskList.querySelectorAll('.subtask-input-row');
    rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        const input = row.querySelector('input[type="text"]');
        const text = input.value.trim();
        if (text) {
            subtasks.push({
                texto: text,
                concluida: checkbox ? (checkbox.checked ? 1 : 0) : 0
            });
        }
    });
    return subtasks;
}

// ============================================================
//  CRIAR TAREFA
// ============================================================

async function createTask() {
    const titulo = createTitle.value.trim();
    if (titulo === '') {
        alert('Digite um título para a tarefa.');
        return;
    }

    const tag = createTag.value;
    const responsavel_id = createResponsavel.value || null;
    const subtarefas = getSubtasksFromContainer(subtaskList);

    try {
        await criarTarefa(titulo, tag, subtarefas, responsavel_id);
        await carregarTarefasDoServidor();
        closeCreateModal();
        render();
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
//  EDIÇÃO DE TAREFAS
// ============================================================

function openEditModal(taskId) {
    const task = tarefas.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    editTitle.value = task.titulo;
    editTag.value = task.tag || '';
    editResponsavel.value = task.responsavel_id || '';
    loadSubtasksIntoContainer(editSubtaskList, task.subtarefas || []);
    editModal.classList.add('active');
    editTitle.focus();
}

function closeEditModal() {
    editModal.classList.remove('active');
    editingTaskId = null;
    editTitle.value = '';
    editTag.value = '';
    editResponsavel.value = '';
    editSubtaskList.innerHTML = '';
}

async function salvarEdicaoComVerificacao() {
    if (editingTaskId === null) return;

    const titulo = editTitle.value.trim();
    if (titulo === '') {
        alert('O título não pode ficar vazio.');
        return;
    }

    const tag = editTag.value;
    const responsavel_id = editResponsavel.value || null;
    const subtarefas = getEditSubtasks();

    try {
        await atualizarTarefa(editingTaskId, titulo, tag, subtarefas, responsavel_id);
        await carregarTarefasDoServidor();

        const task = tarefas.find(t => t.id === editingTaskId);
        if (task && task.subtarefas && task.subtarefas.length > 0) {
            await verificarEAtualizarStatusTarefa(editingTaskId);
        }

        closeEditModal();
        render();
    } catch (error) {
        alert(error.message);
    }
}

// ============================================================
//  EXCLUSÃO
// ============================================================

let pendingDeleteId = null;

function confirmarExclusao(taskId) {
    pendingDeleteId = taskId;
    confirmTitle.textContent = '🗑️ Excluir Tarefa';
    confirmMessage.textContent = 'Tem certeza que deseja excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.';
    confirmModal.classList.add('active');

    confirmActionBtn.onclick = executarExclusao;
}

async function executarExclusao() {
    if (pendingDeleteId === null) return;

    try {
        await deletarTarefa(pendingDeleteId);
        await carregarTarefasDoServidor();
        closeConfirmModal();
        render();
    } catch (error) {
        alert(error.message);
    }
}

function closeConfirmModal() {
    confirmModal.classList.remove('active');
    pendingDeleteId = null;
}

// ============================================================
//  LIMPAR TUDO
// ============================================================

async function clearAllTasks() {
    if (tarefas.length === 0) return;

    confirmTitle.textContent = '⚠️ Limpar Todas as Tarefas';
    confirmMessage.textContent = `Tem certeza que deseja excluir TODAS as ${tarefas.length} tarefas? Esta ação não pode ser desfeita.`;
    confirmModal.classList.add('active');

    confirmActionBtn.onclick = async () => {
        try {
            for (const task of tarefas) {
                await deletarTarefa(task.id);
            }
            await carregarTarefasDoServidor();
            closeConfirmModal();
            render();
        } catch (error) {
            alert(error.message);
        }
    };
}

// ============================================================
//  CONTADORES E ESTATÍSTICAS
// ============================================================

function updateCounters() {
    for (const status of ['todo', 'doing', 'done']) {
        const count = tarefas.filter(t => t.status === status).length;
        const el = document.getElementById(statusMap[status].countId);
        if (el) el.textContent = count;
    }
}

function updateStats() {
    const total = tarefas.length;
    const done = tarefas.filter(t => t.status === 'done').length;
    const pending = total - done;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = done;
    document.getElementById('pendingTasks').textContent = pending;
}

function formatarData(dataStr) {
    if (!dataStr) return 'Sem data';
    const data = new Date(dataStr);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

// ============================================================
//  FILTROS
// ============================================================

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    });
});

// ============================================================
//  CONFIGURAR EVENTOS
// ============================================================

function configurarEventos() {
    // --- Criação ---
    openCreateBtn.addEventListener('click', openCreateModal);
    saveCreateBtn.addEventListener('click', createTask);
    cancelCreateBtn.addEventListener('click', closeCreateModal);
    closeCreateModalBtn.addEventListener('click', closeCreateModal);
    createModal.addEventListener('click', (e) => {
        if (e.target === createModal) closeCreateModal();
    });
    createTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createTask();
    });
    addSubtaskBtn.addEventListener('click', () => {
        addSubtaskInput(subtaskList);
    });

    // --- Edição ---
    saveEditBtn.addEventListener('click', salvarEdicaoComVerificacao);
    cancelEditBtn.addEventListener('click', closeEditModal);
    closeModalBtn.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });
    editTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') salvarEdicaoComVerificacao();
    });
    addEditSubtaskBtn.addEventListener('click', () => {
        addSubtaskInput(editSubtaskList);
    });

    // --- Confirmação ---
    cancelConfirmBtn.addEventListener('click', closeConfirmModal);
    closeConfirmBtn.addEventListener('click', closeConfirmModal);
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
    });

    // --- Limpar tudo ---
    clearAllBtn.addEventListener('click', clearAllTasks);

    // --- Logout ---
    logoutBtn.addEventListener('click', () => {
        confirmTitle.textContent = '🚪 Sair';
        confirmMessage.textContent = 'Tem certeza que deseja sair?';
        confirmModal.classList.add('active');
        confirmActionBtn.onclick = () => {
            logout();
            closeConfirmModal();
        };
    });

    // --- Fechar com ESC ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (createModal.classList.contains('active')) closeCreateModal();
            if (editModal.classList.contains('active')) closeEditModal();
            if (confirmModal.classList.contains('active')) closeConfirmModal();
        }
    });
}

// ============================================================
//  EXPORTAR FUNÇÕES
// ============================================================

window.carregarTarefasDoServidor = carregarTarefasDoServidor;
window.render = render;
window.verificarEAtualizarStatusTarefa = verificarEAtualizarStatusTarefa;