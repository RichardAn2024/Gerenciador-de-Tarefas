/* ============================================================
   script.js - Lógica completa do Dashboard 
   (10 tarefas por coluna por página)
   ============================================================ */

// --- Estado ---
let tarefas = [];
let currentFilter = 'all';
let currentResponsavelFilter = 'all';
let currentSearchTerm = '';
let currentSort = 'nenhum';
let editingTaskId = null;
let usuariosDisponiveis = [];
let usuarioLogado = null;

// --- Paginação ---
let currentPage = 1;
const tasksPerColumn = 10; // 10 tarefas por coluna por página
let totalPages = 1;

// --- Referências DOM ---
const openCreateBtn = document.getElementById('openCreateBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const adminLink = document.getElementById('adminLink');

// --- Pesquisa ---
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// --- Ordenação ---
const sortBy = document.getElementById('sortBy');

// --- Modal de Criação ---
const createModal = document.getElementById('createModal');
const createTitle = document.getElementById('createTitle');
const createTag = document.getElementById('createTag');
const createResponsaveis = document.getElementById('createResponsaveis');
const createPrazo = document.getElementById('createPrazo');
const subtaskList = document.getElementById('subtaskList');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const saveCreateBtn = document.getElementById('saveCreateBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const closeCreateModalBtn = document.getElementById('closeCreateModalBtn');

// --- Modal de Edição ---
const editModal = document.getElementById('editModal');
const editTitle = document.getElementById('editTitle');
const editTag = document.getElementById('editTag');
const editResponsaveis = document.getElementById('editResponsaveis');
const editPrazo = document.getElementById('editPrazo');
const editSubtaskList = document.getElementById('editSubtaskList');
const addEditSubtaskBtn = document.getElementById('addEditSubtaskBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- Filtro Responsável ---
const filterResponsavel = document.getElementById('filterResponsavel');

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
    const token = verificarAutenticacao();
    if (!token) return;

    usuarioLogado = getUsuario();
    if (usuarioLogado) {
        userName.textContent = `👤 ${usuarioLogado.nome}`;
        if (usuarioLogado.isAdmin) {
            adminLink.style.display = 'inline-flex';
        }
    }

    await carregarUsuarios();
    await carregarTarefasDoServidor();
    configurarEventos();
});

// ============================================================
//  CARREGAR USUÁRIOS
// ============================================================

async function carregarUsuarios() {
    try {
        usuariosDisponiveis = await listarUsuarios();
        popularSelectResponsaveis(createResponsaveis);
        popularSelectResponsaveis(editResponsaveis);
        popularFilterResponsavel();
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

function popularSelectResponsaveis(select) {
    if (!select) return;
    while (select.options.length > 1) {
        select.remove(1);
    }

    if (usuarioLogado) {
        const optionEu = document.createElement('option');
        optionEu.value = usuarioLogado.id;
        optionEu.textContent = `👤 Eu (${usuarioLogado.nome})`;
        optionEu.style.fontWeight = 'bold';
        optionEu.style.color = '#F57C00';
        select.appendChild(optionEu);
    }

    usuariosDisponiveis.forEach(usuario => {
        if (usuarioLogado && usuario.id === usuarioLogado.id) return;
        const option = document.createElement('option');
        option.value = usuario.id;
        option.textContent = `${usuario.nome} (${usuario.email})`;
        select.appendChild(option);
    });
}

function popularFilterResponsavel() {
    if (!filterResponsavel) return;

    while (filterResponsavel.options.length > 1) {
        filterResponsavel.remove(1);
    }

    if (usuarioLogado) {
        const optionEu = document.createElement('option');
        optionEu.value = usuarioLogado.id;
        optionEu.textContent = `👤 Eu (${usuarioLogado.nome})`;
        optionEu.style.fontWeight = 'bold';
        optionEu.style.color = '#F57C00';
        filterResponsavel.appendChild(optionEu);
    }

    usuariosDisponiveis.forEach(usuario => {
        if (usuarioLogado && usuario.id === usuarioLogado.id) return;
        const option = document.createElement('option');
        option.value = usuario.id;
        option.textContent = `${usuario.nome}`;
        filterResponsavel.appendChild(option);
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
//  ORDENAÇÃO - SÓ QUANDO SELECIONADO
// ============================================================

function sortTasks(tasks) {
    if (currentSort === 'nenhum') {
        return tasks;
    }

    const sortFunctions = {
        'criacao_asc': (a, b) => new Date(a.data_criacao) - new Date(b.data_criacao),
        'criacao_desc': (a, b) => new Date(b.data_criacao) - new Date(a.data_criacao),
        'prazo_asc': (a, b) => {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(a.prazo) - new Date(b.prazo);
        },
        'prazo_desc': (a, b) => {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(b.prazo) - new Date(a.prazo);
        },
        'titulo_asc': (a, b) => a.titulo.localeCompare(b.titulo),
        'titulo_desc': (a, b) => b.titulo.localeCompare(a.titulo),
        'status_asc': (a, b) => {
            const order = { 'todo': 0, 'doing': 1, 'done': 2 };
            return (order[a.status] || 0) - (order[b.status] || 0);
        },
        'status_desc': (a, b) => {
            const order = { 'todo': 0, 'doing': 1, 'done': 2 };
            return (order[b.status] || 0) - (order[a.status] || 0);
        }
    };

    const sortFn = sortFunctions[currentSort] || sortFunctions['criacao_desc'];
    return [...tasks].sort(sortFn);
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================

function render() {
    let filtered = tarefas;

    // Filtrar por status
    if (currentFilter !== 'all') {
        filtered = filtered.filter(t => t.status === currentFilter);
    }

    // Filtrar por responsável
    if (currentResponsavelFilter !== 'all') {
        filtered = filtered.filter(t => {
            const responsaveis = t.responsaveis_ids || [];
            return responsaveis.includes(parseInt(currentResponsavelFilter));
        });
    }

    // Filtrar por pesquisa
    if (currentSearchTerm.trim() !== '') {
        const term = currentSearchTerm.toLowerCase().trim();
        filtered = filtered.filter(t =>
            t.titulo.toLowerCase().includes(term)
        );
    }

    // Ordenação
    filtered = sortTasks(filtered);

    // Paginação - 10 por coluna
    const paginatedTasks = getPaginatedTasks(filtered);

    // Limpar listas
    for (const status of ['todo', 'doing', 'done']) {
        const list = document.getElementById(statusMap[status].listId);
        list.innerHTML = '';
    }

    // Preencher colunas
    for (const status of ['todo', 'doing', 'done']) {
        const list = document.getElementById(statusMap[status].listId);
        const tasksInStatus = paginatedTasks.filter(t => t.status === status);

        if (tasksInStatus.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';

            if (currentSearchTerm.trim() !== '') {
                empty.textContent = `Nenhuma tarefa encontrada para "${currentSearchTerm}"`;
            } else {
                empty.textContent = 'Nenhuma tarefa aqui';
            }
            list.appendChild(empty);
            continue;
        }

        tasksInStatus.forEach(task => {
            const card = createTaskCard(task);
            list.appendChild(card);
        });
    }

    renderPagination(filtered.length);
    updateCounters();
    updateStats();
}

// ============================================================
//  PAGINAÇÃO: 10 TAREFAS POR COLUNA
// ============================================================

function getPaginatedTasks(filteredTasks) {
    // Agrupar tarefas por status
    const tasksByStatus = {
        todo: filteredTasks.filter(t => t.status === 'todo'),
        doing: filteredTasks.filter(t => t.status === 'doing'),
        done: filteredTasks.filter(t => t.status === 'done')
    };

    // Calcular total de páginas baseado na maior coluna
    const maxTasksPerColumn = Math.max(
        tasksByStatus.todo.length,
        tasksByStatus.doing.length,
        tasksByStatus.done.length
    );

    totalPages = Math.ceil(maxTasksPerColumn / tasksPerColumn);
    if (totalPages === 0) totalPages = 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Pegar tarefas de cada coluna para a página atual
    const startIndex = (currentPage - 1) * tasksPerColumn;
    const endIndex = startIndex + tasksPerColumn;

    const result = [];

    for (const status of ['todo', 'doing', 'done']) {
        const tasks = tasksByStatus[status] || [];
        const pageTasks = tasks.slice(startIndex, endIndex);
        result.push(...pageTasks);
    }

    return result;
}

function renderPagination(totalTasks) {
    const container = document.getElementById('paginationContainer');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const info = document.getElementById('paginationInfo');
    const pageNumbers = document.getElementById('pageNumbers');

    if (!container) return;

    if (totalTasks === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    info.textContent = `Página ${currentPage} de ${totalPages}`;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    pageNumbers.innerHTML = '';

    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, currentPage + 3);

    if (currentPage <= 3) {
        endPage = Math.min(totalPages, 7);
    }

    if (currentPage >= totalPages - 2) {
        startPage = Math.max(1, totalPages - 6);
    }

    if (startPage > 1) {
        addPageNumber(1);
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '…';
            dots.style.cssText = 'padding: 4px 8px; color: #8c929a;';
            pageNumbers.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageNumber(i);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '…';
            dots.style.cssText = 'padding: 4px 8px; color: #8c929a;';
            pageNumbers.appendChild(dots);
        }
        addPageNumber(totalPages);
    }
}

function addPageNumber(page) {
    const pageNumbers = document.getElementById('pageNumbers');
    const btn = document.createElement('button');
    btn.className = `page-number-btn${page === currentPage ? ' active' : ''}`;
    btn.textContent = page;
    btn.addEventListener('click', () => {
        currentPage = page;
        render();
    });
    pageNumbers.appendChild(btn);
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
        todo: '#F57C00',
        doing: '#F57C00',
        done: '#00a86b'
    };
    card.style.borderLeftColor = borderColors[task.status] || '#F57C00';

    const isOverdue = task.prazo && task.status !== 'done' && new Date(task.prazo) < new Date();
    if (isOverdue) {
        card.style.borderLeftColor = '#ff4d4f';
        card.style.borderLeftWidth = '6px';
    }

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.titulo;
    if (isOverdue) {
        title.innerHTML += ' <span style="color:#ff4d4f;font-size:12px;">🔴 ATRASADA</span>';
    }
    card.appendChild(title);

    if (task.criador_nome) {
        const criadorEl = document.createElement('div');
        criadorEl.className = 'task-criador';
        const isEu = usuarioLogado && task.criador_id === usuarioLogado.id;
        const texto = isEu ? `Eu (${task.criador_nome})` : task.criador_nome;
        criadorEl.innerHTML = `👤 <strong>Criador:</strong> ${texto}`;
        if (isEu) {
            criadorEl.style.background = '#e3edff';
            criadorEl.style.border = '1px solid #F57C00';
            criadorEl.style.padding = '2px 10px';
            criadorEl.style.borderRadius = '12px';
            criadorEl.style.display = 'inline-block';
            criadorEl.style.marginBottom = '4px';
        } else {
            criadorEl.style.cssText = 'font-size: 12px; color: #6b6f76; margin-bottom: 4px;';
        }
        card.appendChild(criadorEl);
    }

    if (task.responsaveis_nomes && task.responsaveis_nomes.length > 0) {
        const responsavelEl = document.createElement('div');
        responsavelEl.className = 'task-responsavel';

        const nomes = task.responsaveis_nomes.map(nome => {
            const isEu = usuarioLogado && task.responsaveis_ids.includes(usuarioLogado.id);
            return isEu ? `Eu (${nome})` : nome;
        }).join(', ');

        responsavelEl.innerHTML = `👤 <strong>Responsáveis:</strong> ${nomes}`;
        responsavelEl.style.background = '#fff3e0';
        responsavelEl.style.border = '1px solid #F57C00';
        responsavelEl.style.padding = '4px 10px';
        responsavelEl.style.borderRadius = '12px';
        responsavelEl.style.display = 'inline-block';
        responsavelEl.style.marginBottom = '4px';
        card.appendChild(responsavelEl);
    }

    const dateEl = document.createElement('div');
    dateEl.className = 'task-date';
    dateEl.innerHTML = `📅 Criado: ${formatarData(task.data_criacao)}`;
    card.appendChild(dateEl);

    if (task.prazo) {
        const prazoEl = document.createElement('div');
        prazoEl.className = 'task-date task-prazo';
        const dataPrazo = new Date(task.prazo);
        const hoje = new Date();
        const isVencido = task.status !== 'done' && dataPrazo < hoje;
        const emoji = isVencido ? '🔴' : '📅';
        prazoEl.innerHTML = `${emoji} Prazo: ${formatarData(task.prazo)}`;
        if (isVencido) {
            prazoEl.style.color = '#ff4d4f';
            prazoEl.style.fontWeight = 'bold';
        } else {
            prazoEl.style.color = '#F57C00';
        }
        card.appendChild(prazoEl);
    }

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
//  VERIFICAR E ATUALIZAR STATUS DA TAREFA
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
    Array.from(createResponsaveis.options).forEach(opt => opt.selected = false);
    createPrazo.value = '';
    subtaskList.innerHTML = '';
    createModal.classList.add('active');
    createTitle.focus();
}

function closeCreateModal() {
    createModal.classList.remove('active');
    createTitle.value = '';
    createTag.value = '';
    Array.from(createResponsaveis.options).forEach(opt => opt.selected = false);
    createPrazo.value = '';
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
            checkbox.style.cssText = 'width: 16px; height: 16px; accent-color: #F57C00; cursor: pointer;';
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
    const responsaveis = Array.from(createResponsaveis.selectedOptions)
        .map(opt => parseInt(opt.value))
        .filter(id => !isNaN(id) && id > 0);
    const prazo = createPrazo.value || null;
    const subtarefas = getSubtasksFromContainer(subtaskList);

    try {
        await criarTarefa(titulo, tag, subtarefas, responsaveis, prazo);
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

    const responsaveisIds = task.responsaveis_ids || [];
    Array.from(editResponsaveis.options).forEach(opt => {
        opt.selected = responsaveisIds.includes(parseInt(opt.value));
    });

    editPrazo.value = task.prazo || '';
    loadSubtasksIntoContainer(editSubtaskList, task.subtarefas || []);
    editModal.classList.add('active');
    editTitle.focus();
}

function closeEditModal() {
    editModal.classList.remove('active');
    editingTaskId = null;
    editTitle.value = '';
    editTag.value = '';
    Array.from(editResponsaveis.options).forEach(opt => opt.selected = false);
    editPrazo.value = '';
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
    const responsaveis = Array.from(editResponsaveis.selectedOptions)
        .map(opt => parseInt(opt.value))
        .filter(id => !isNaN(id) && id > 0);
    const prazo = editPrazo.value || null;
    const subtarefas = getEditSubtasks();

    try {
        await atualizarTarefa(editingTaskId, titulo, tag, subtarefas, responsaveis, prazo);
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

    const hoje = new Date();
    const overdue = tarefas.filter(t => t.prazo && t.status !== 'done' && new Date(t.prazo) < hoje).length;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = done;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('overdueTasks').textContent = overdue;
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
//  FILTROS - COM RESET DE PÁGINA
// ============================================================

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        currentPage = 1;
        render();
    });
});

if (filterResponsavel) {
    filterResponsavel.addEventListener('change', () => {
        currentResponsavelFilter = filterResponsavel.value;
        currentPage = 1;
        render();
    });
}

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

    // --- Pesquisa ---
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        currentPage = 1;
        render();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchTerm = '';
        currentPage = 1;
        render();
        searchInput.focus();
    });

    // --- Ordenação ---
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            currentSort = sortBy.value;
            currentPage = 1;
            render();
        });
    }

    // --- Paginação ---
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                render();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                render();
            }
        });
    }

    // --- Fechar com ESC ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (createModal.classList.contains('active')) closeCreateModal();
            if (editModal.classList.contains('active')) closeEditModal();
            if (confirmModal.classList.contains('active')) closeConfirmModal();
        }
    });
}

window.carregarTarefasDoServidor = carregarTarefasDoServidor;
window.render = render;
window.verificarEAtualizarStatusTarefa = verificarEAtualizarStatusTarefa;