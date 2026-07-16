let allTarefas = [];
let statusTab = 'pendente'; // aba ativa

const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  loadTarefas();
  loadUsuariosSelect();

  document.getElementById('tipoTarefa').addEventListener('change', toggleTipoFields);
  document.getElementById('formTarefa').addEventListener('submit', handleCriarTarefa);

  // Limita seleção de dias a 3
  document.getElementById('diasSemanaPicker').addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    const checked = document.querySelectorAll('#diasSemanaPicker input:checked');
    if (checked.length > 3) {
      e.target.checked = false;
      showMsg('Máximo de 3 dias por semana.', 'error');
    }
  });
});

// ── Aba ativa ──
function setTabStatus(status) {
  statusTab = status;
  document.querySelectorAll('.tarefa-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + status.charAt(0).toUpperCase() + status.slice(1))?.classList.add('active');
  renderTarefas();
}

// ── Tipo de tarefa ──
function toggleTipoFields() {
  const tipo = document.getElementById('tipoTarefa').value;
  document.getElementById('prazoWrap').style.display       = tipo === 'prazo'    ? '' : 'none';
  document.getElementById('diasSemanaWrap').style.display  = tipo === 'semanal'  ? '' : 'none';
}

// ── Carrega tarefas ──
async function loadTarefas() {
  try {
    const hoje    = new Date().toISOString().slice(0, 10);
    const diaSem  = new Date().getDay(); // 0=dom ... 6=sab
    const empresa = getEmpresaAtiva();
    const user    = getSessionUser();
    const isAdm   = isAdmin();

    const rows = await (isAdm
      ? sbFetch(`tarefas?empresa_id=eq.${empresa}&status=neq.arquivada&order=criado_em.desc`)
      : sbFetch(`tarefas?empresa_id=eq.${empresa}&atribuido_para=eq.${user.id}&status=neq.arquivada&order=criado_em.desc`)
    );

    allTarefas = rows || [];

    // Arquivamento automático: concluída há mais de 5 dias sai da lista sozinha
    // (sem botão/aba — só desaparece do quadro; fica salva no banco como 'arquivada')
    const cincoDiasAtras = new Date(Date.now() - 5 * 86400000);
    const arquivamentos = [];
    allTarefas = allTarefas.filter(t => {
      if (t.status !== 'concluida' || !t.atualizado_em) return true;
      if (new Date(t.atualizado_em) > cincoDiasAtras) return true;
      arquivamentos.push(dbUpdateTarefa(t.id, { status: 'arquivada' }).catch(() => {}));
      return false;
    });
    if (arquivamentos.length) await Promise.all(arquivamentos);

    // Reset automático
    const resets = [];
    for (const t of allTarefas) {
      if (t.status !== 'concluida') continue;

      const deveResetar =
        (t.tipo === 'diaria'  && t.ultimo_reset !== hoje) ||
        (t.tipo === 'semanal' && Array.isArray(t.dias_semana) && t.dias_semana.includes(diaSem) && t.ultimo_reset !== hoje);

      if (deveResetar) {
        resets.push(sbFetch(`tarefas?id=eq.${t.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'pendente', ultimo_reset: hoje })
        }));
        t.status      = 'pendente';
        t.ultimo_reset = hoje;
      }
    }
    if (resets.length) await Promise.all(resets);

    renderTarefas();
  } catch(e) { console.error(e); }
}

// ── Renderiza ──
function renderTarefas() {
  const hoje   = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const pendente  = allTarefas.filter(t => t.status === 'pendente');
  const andamento = allTarefas.filter(t => t.status === 'andamento');
  const concluida = allTarefas.filter(t => t.status === 'concluida');

  document.getElementById('countPendente').textContent  = pendente.length;
  document.getElementById('countAndamento').textContent = andamento.length;
  document.getElementById('countConcluida').textContent = concluida.length;

  const lista = statusTab === 'pendente'  ? pendente
              : statusTab === 'andamento' ? andamento
              : concluida;

  const empty = document.getElementById('tarefasEmpty');
  const grid  = document.getElementById('tarefasList');

  if (!lista.length) {
    const msgs = {
      pendente:  'Nenhuma tarefa pendente! 🎉',
      andamento: 'Nenhuma tarefa em andamento.',
      concluida: 'Nenhuma tarefa concluída ainda.',
    };
    empty.querySelector ? (empty.querySelector('div + *') || empty).textContent = '' : null;
    empty.innerHTML = `<div class="links-empty-icon">✅</div>${msgs[statusTab]}`;
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = lista.map(t => {
    const vencendo = t.prazo && t.prazo <= amanha && t.status !== 'concluida';
    const vencido  = t.prazo && t.prazo < hoje    && t.status !== 'concluida';

    const priorIcon = t.prioridade === 'alta' ? '🔴' : t.prioridade === 'media' ? '🟡' : '🟢';

    let tipoLabel = '';
    if (t.tipo === 'diaria')  tipoLabel = '<span class="tarefa-badge-diaria">🔄 Diária</span>';
    if (t.tipo === 'semanal' && Array.isArray(t.dias_semana)) {
      const nomes = t.dias_semana.sort().map(d => DIAS_NOMES[d]).join(', ');
      tipoLabel = `<span class="tarefa-badge-diaria">📆 ${nomes}</span>`;
    }

    const statusNext = t.status === 'pendente' ? 'andamento'
                     : t.status === 'andamento' ? 'concluida'
                     : 'pendente';
    const statusLabel = t.status === 'pendente'  ? '⏳ Pendente'
                      : t.status === 'andamento' ? '🔵 Em andamento'
                      : '✅ Concluída';

    return `
      <div class="tarefa-card ${vencido ? 'tarefa-vencida' : vencendo ? 'tarefa-vencendo' : ''}" onclick="abrirTarefaModal('${t.id}')">
        <div class="tarefa-card-header">
          <div class="tarefa-titulo">${escapeHtml(t.titulo)}</div>
          <span class="tarefa-prioridade ${t.prioridade}">${priorIcon}</span>
        </div>
        ${t.descricao ? `<p class="tarefa-desc">${escapeHtml(t.descricao)}</p>` : ''}
        <div class="tarefa-meta">
          ${tipoLabel}
          ${t.prazo ? `<span>📅 ${formatDate(t.prazo)}</span>` : ''}
          <span>👤 ${escapeHtml(t.atribuido_para_nome || '—')}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px" onclick="event.stopPropagation()">
          <button class="mini tarefa-status-btn ${t.status}" onclick="avancarStatus('${t.id}','${statusNext}')" style="flex:1;justify-content:center">
            ${t.status === 'concluida' ? '↩ Reabrir' : t.status === 'andamento' ? '✅ Concluir' : '▶ Iniciar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Avança status ──
async function avancarStatus(id, novoStatus) {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    await dbUpdateTarefa(id, {
      status: novoStatus,
      ...(novoStatus === 'concluida' ? { ultimo_reset: hoje } : {}),
    });
    const t = allTarefas.find(t => t.id === id);
    if (t) t.status = novoStatus;
    renderTarefas();
  } catch(e) { console.error(e); }
}

// ── Carrega checkboxes de usuários ──
// ── Gerencia lista de atribuídos (select + add) ──
let atribuidosData = [];

async function loadUsuariosSelect() {
  try {
    const users = await dbGetUsuarios();
    const user  = getSessionUser();
    const sel   = document.getElementById('atribuidoParaSelect');
    sel.innerHTML = (users || []).map(u =>
      `<option value="${u.id}" data-nome="${escapeHtml(u.nome)}">${escapeHtml(u.nome)}${u.id === user.id ? ' (eu)' : ''}</option>`
    ).join('');
    atribuidosData = [{ id: user.id, nome: user.nome }];
    renderAtribuidosChips();
  } catch(e) { console.error(e); }
}

function adicionarAtribuido() {
  const sel  = document.getElementById('atribuidoParaSelect');
  const id   = sel.value;
  const nome = sel.options[sel.selectedIndex]?.dataset.nome || '';
  if (!id) return;
  if (atribuidosData.find(a => a.id === id)) { showMsg('Pessoa já adicionada.', 'error'); return; }
  atribuidosData.push({ id, nome });
  renderAtribuidosChips();
}

function removerAtribuido(id) {
  atribuidosData = atribuidosData.filter(a => a.id !== id);
  renderAtribuidosChips();
}

function renderAtribuidosChips() {
  const wrap = document.getElementById('atribuidosList');
  if (!wrap) return;
  wrap.innerHTML = atribuidosData.map(a => `
    <span class="atribuido-chip">
      ${escapeHtml(a.nome)}
      <button type="button" onclick="removerAtribuido('${a.id}')" title="Remover">✕</button>
    </span>
  `).join('');
}

// ── Cria tarefa ──
async function handleCriarTarefa(e) {
  e.preventDefault();
  const user = getSessionUser();
  const tipo = document.getElementById('tipoTarefa').value;

  if (!atribuidosData.length) { showMsg('Adicione ao menos uma pessoa.', 'error'); return; }

  let diasSemana = null;
  if (tipo === 'semanal') {
    const dias = [...document.querySelectorAll('#diasSemanaPicker input:checked')];
    diasSemana = dias.map(c => parseInt(c.value));
    if (!diasSemana.length) { showMsg('Selecione ao menos 1 dia da semana.', 'error'); return; }
  }

  const titulo = document.getElementById('tituloTarefa').value.trim();
  if (!titulo) { showMsg('Título é obrigatório.', 'error'); return; }

  const base = {
    titulo,
    descricao:           document.getElementById('descTarefa').value.trim(),
    tipo,
    prioridade:          document.getElementById('priorTarefa').value,
    status:              'pendente',
    prazo:               tipo === 'prazo' ? (document.getElementById('prazoTarefa').value || null) : null,
    resetar_diario:      tipo === 'diaria',
    dias_semana:         diasSemana,
    ultimo_reset:        (tipo === 'diaria' || tipo === 'semanal') ? new Date().toISOString().slice(0, 10) : null,
    empresa:             getEmpresaNome(),
    empresa_id:          getEmpresaAtiva(),
    criado_por:          user.id,
    criado_por_nome:     user.nome,
  };

  try {
    await Promise.all(atribuidosData.map(a => sbFetch('tarefas', {
      method: 'POST',
      body: JSON.stringify({ ...base, atribuido_para: a.id, atribuido_para_nome: a.nome })
    })));

    const qtd = atribuidosData.length;
    document.getElementById('formTarefa').reset();
    toggleTipoFields();
    atribuidosData = [{ id: user.id, nome: user.nome }];
    renderAtribuidosChips();
    showMsg(`Tarefa criada para ${qtd} pessoa${qtd > 1 ? 's' : ''}!`, 'ok');
    await loadTarefas();
  } catch(err) { showMsg('Erro: ' + err.message, 'error'); }
}

// ── Parser de descrição (tenta identificar campos comuns) ──
const CAMPOS_DESC = [
  { chave: 'cliente',     labels: ['Reenviar para', 'Cliente'] },
  { chave: 'endereco',    labels: ['Endereço', 'Endereco'] },
  { chave: 'complemento', labels: ['Complemento'] },
  { chave: 'cep',         labels: ['CEP'] },
  { chave: 'telefone',    labels: ['Telefone', 'WhatsApp'] },
  { chave: 'motivo',      labels: ['Motivo', 'Observações', 'Observação', 'Obs'] },
];

function parseDescricaoTarefa(texto) {
  if (!texto) return null;
  const todosLabels = CAMPOS_DESC.flatMap(c => c.labels.map(l => ({ chave: c.chave, label: l })));
  const regexLabels = new RegExp('\\b(' + todosLabels.map(l => l.label).join('|') + ')\\s*:', 'gi');
  const matches = [...texto.matchAll(regexLabels)];
  if (matches.length < 2) return null; // não tem estrutura suficiente, mostra cru

  const campos = {};
  let sobra = matches[0].index > 0 ? texto.slice(0, matches[0].index).trim() : '';

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const chave = todosLabels.find(l => l.label.toLowerCase() === m[1].toLowerCase())?.chave;
    const start = m.index + m[0].length;
    const end   = i + 1 < matches.length ? matches[i + 1].index : texto.length;
    let valor = texto.slice(start, end).trim().replace(/[,;]+$/, '');

    if (chave === 'telefone') {
      const fone = valor.match(/\(?\d{2}\)?[\s.-]?\d{4,5}-?\d{4}/);
      if (fone) {
        const depois = valor.slice(fone.index + fone[0].length).trim();
        valor = fone[0];
        if (depois) sobra += (sobra ? ' ' : '') + depois;
      }
    }
    if (chave && valor) campos[chave] = campos[chave] ? campos[chave] + ' ' + valor : valor;
  }

  if (sobra) campos.motivo = campos.motivo ? campos.motivo + ' ' + sobra : sobra;
  return campos;
}

function getIniciaisNome(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';
}

// ── Modal de tarefa ──
let modalTarefaId = null;

function abrirTarefaModal(id) {
  const t = allTarefas.find(t => t.id === id);
  if (!t) return;
  modalTarefaId = id;

  document.getElementById('modalTituloTarefa').textContent = t.titulo;

  const badge = document.getElementById('modalPrioridadeBadge');
  badge.textContent = t.prioridade === 'alta' ? '🔴 Prioridade alta' : t.prioridade === 'media' ? '🟡 Prioridade média' : '🟢 Prioridade baixa';
  badge.className = `tarefa-prio-badge ${t.prioridade}`;

  document.getElementById('modalAtribuidoPara').textContent = t.atribuido_para_nome || '—';
  document.getElementById('modalCriadoPor').textContent     = t.criado_por_nome || '—';
  document.getElementById('modalPrazo').textContent         = t.prazo ? formatDate(t.prazo) : '—';

  let tipoTxt = t.tipo === 'diaria' ? '🔄 Diária'
              : t.tipo === 'semanal' && Array.isArray(t.dias_semana)
                ? `📆 Semanal (${t.dias_semana.sort().map(d => DIAS_NOMES[d]).join(', ')})`
              : '📅 Com prazo';
  document.getElementById('modalTipo').textContent = tipoTxt;

  // Descrição: estruturada se der pra identificar campos, senão crua
  const campos = parseDescricaoTarefa(t.descricao);
  const estruturada = document.getElementById('modalDescEstruturada');
  const crua = document.getElementById('modalDescTarefa');

  if (campos && (campos.cliente || campos.endereco || campos.telefone || campos.motivo)) {
    estruturada.classList.remove('hidden');
    crua.classList.add('hidden');

    const clienteRow = document.getElementById('modalClienteRow');
    if (campos.cliente) {
      clienteRow.classList.remove('hidden');
      document.getElementById('modalClienteAvatar').textContent = getIniciaisNome(campos.cliente);
      document.getElementById('modalClienteNome').textContent   = campos.cliente;
    } else clienteRow.classList.add('hidden');

    const endRow = document.getElementById('modalEnderecoRow');
    const enderecoCompleto = [campos.endereco, campos.complemento].filter(Boolean).join(' — ') + (campos.cep ? ` · CEP ${campos.cep}` : '');
    if (enderecoCompleto.trim()) {
      endRow.classList.remove('hidden');
      document.getElementById('modalEndereco').textContent = enderecoCompleto.trim();
    } else endRow.classList.add('hidden');

    const telRow = document.getElementById('modalTelefoneRow');
    if (campos.telefone) {
      telRow.classList.remove('hidden');
      document.getElementById('modalTelefone').textContent = campos.telefone;
    } else telRow.classList.add('hidden');

    const motivoRow = document.getElementById('modalMotivoRow');
    if (campos.motivo) {
      motivoRow.classList.remove('hidden');
      document.getElementById('modalMotivo').textContent = campos.motivo;
    } else motivoRow.classList.add('hidden');
  } else {
    estruturada.classList.add('hidden');
    crua.classList.remove('hidden');
    crua.textContent = t.descricao || '—';
  }

  loadUsuariosReatribuir(t.atribuido_para);
  loadComentarios(id);
  document.getElementById('tarefaModal').classList.remove('hidden');
}

async function loadUsuariosReatribuir(atualId) {
  const sel = document.getElementById('modalReatribuirSelect');
  sel.innerHTML = '<option value="">Carregando...</option>';
  try {
    const users = await dbGetUsuarios();
    sel.innerHTML = (users || []).map(u =>
      `<option value="${u.id}" data-nome="${escapeHtml(u.nome)}" ${u.id === atualId ? 'selected' : ''}>${escapeHtml(u.nome)}</option>`
    ).join('');
  } catch(e) { sel.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

async function reatribuirTarefa() {
  if (!modalTarefaId) return;
  const sel  = document.getElementById('modalReatribuirSelect');
  const id   = sel.value;
  const nome = sel.options[sel.selectedIndex]?.dataset.nome || '';
  if (!id) return;

  try {
    await dbUpdateTarefa(modalTarefaId, { atribuido_para: id, atribuido_para_nome: nome });
    const t = allTarefas.find(t => t.id === modalTarefaId);
    if (t) { t.atribuido_para = id; t.atribuido_para_nome = nome; }
    document.getElementById('modalAtribuidoPara').textContent = nome;
    renderTarefas();
    alert(`Tarefa atribuída para ${nome}!`);
  } catch(e) {
    alert('Erro ao reatribuir: ' + e.message);
  }
}

function fecharTarefaModal() {
  document.getElementById('tarefaModal').classList.add('hidden');
  modalTarefaId = null;
}

async function loadComentarios(tarefaId) {
  const list = document.getElementById('comentariosList');
  list.innerHTML = '<p style="color:var(--muted);font-size:12px">Carregando...</p>';
  try {
    const rows = await sbFetch(`tarefa_comentarios?tarefa_id=eq.${tarefaId}&order=criado_em.asc`);
    if (!rows?.length) { list.innerHTML = '<p style="color:var(--muted);font-size:12px">Nenhum comentário ainda.</p>'; return; }
    list.innerHTML = rows.map(c => `
      <div class="comentario-item">
        <div class="comentario-meta">${escapeHtml(c.usuario_nome)} · ${formatDateTime(c.criado_em)}</div>
        <div class="comentario-texto">${escapeHtml(c.texto)}</div>
      </div>
    `).join('');
  } catch(e) { list.innerHTML = ''; }
}

async function enviarComentario() {
  if (!modalTarefaId) return;
  const input = document.getElementById('comentarioInput');
  const texto = input.value.trim();
  if (!texto) return;
  const user = getSessionUser();
  try {
    await sbFetch('tarefa_comentarios', { method: 'POST', body: JSON.stringify({
      tarefa_id: modalTarefaId,
      usuario_id: user.id,
      usuario_nome: user.nome,
      texto,
      empresa_id: getEmpresaAtiva(),
    })});
    input.value = '';
    loadComentarios(modalTarefaId);
  } catch(e) { console.error(e); }
}

async function deletarTarefa() {
  if (!modalTarefaId) return;
  if (!confirm('Remover esta tarefa?')) return;
  try {
    await sbFetch(`tarefas?id=eq.${modalTarefaId}`, { method: 'DELETE', prefer: '' });
    fecharTarefaModal();
    await loadTarefas();
  } catch(e) {
    console.error(e);
    alert('Erro ao remover: ' + e.message);
  }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}
