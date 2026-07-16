let allNotas = [];
let filtroNota = 'todas';

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  await loadNotas();

  document.getElementById('formNota').addEventListener('submit', handleCreateNota);
});

function hojeStr() {
  return new Date().toISOString().slice(0, 10);
}

function setDataRapida(diasAdiante) {
  const d = new Date();
  d.setDate(d.getDate() + diasAdiante);
  document.getElementById('notaData').value = d.toISOString().slice(0, 10);
}

async function loadNotas() {
  try {
    const empresa = getEmpresaAtiva();
    const user = getSessionUser();
    allNotas = await dbGetNotas(empresa, user.id) || [];
    renderNotas();
  } catch(e) { console.error(e); }
}

function setFiltroNota(f) {
  filtroNota = f;
  document.querySelectorAll('#notaTabs .tarefa-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + f.charAt(0).toUpperCase() + f.slice(1))?.classList.add('active');
  renderNotas();
}

function badgeData(dataAlvo) {
  if (!dataAlvo) return { texto: null, cls: '' };
  const hoje    = hojeStr();
  const amanha  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dataAlvo < hoje)   return { texto: `⚠️ Atrasada — ${formatDate(dataAlvo)}`, cls: 'nota-data-atrasada' };
  if (dataAlvo === hoje) return { texto: '🔔 Hoje', cls: 'nota-data-hoje' };
  if (dataAlvo === amanha) return { texto: '☀️ Amanhã', cls: 'nota-data-amanha' };
  return { texto: `📅 ${formatDate(dataAlvo)}`, cls: 'nota-data-futura' };
}

function renderNotas() {
  const todas      = allNotas;
  const pendentes  = allNotas.filter(n => !n.concluida);
  const concluidas = allNotas.filter(n => n.concluida);

  document.getElementById('countTodas').textContent      = todas.length;
  document.getElementById('countPendentes').textContent  = pendentes.length;
  document.getElementById('countConcluidas').textContent = concluidas.length;

  document.getElementById('countChip').innerHTML =
    `<span class="status-dot-green"></span>${todas.length} nota${todas.length !== 1 ? 's' : ''}`;

  const lista = filtroNota === 'pendentes'  ? pendentes
              : filtroNota === 'concluidas' ? concluidas
              : todas;

  const empty = document.getElementById('notasEmpty');
  const grid  = document.getElementById('notasList');

  if (!lista.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = lista.map(n => {
    const badge = badgeData(n.data_alvo);
    return `
      <div class="nota-card nc-${n.cor || 'amarelo'} ${n.concluida ? 'nota-concluida' : ''}">
        <div class="nota-header">
          ${n.titulo ? `<div class="nota-titulo">${escapeHtml(n.titulo)}</div>` : '<div></div>'}
          <button class="nota-pin-btn ${n.fixado ? 'pinned' : ''}" onclick="togglePin('${n.id}', ${!n.fixado})" title="Fixar">📌</button>
        </div>
        <p class="nota-texto">${escapeHtml(n.conteudo)}</p>
        ${badge.texto ? `<span class="nota-data-badge ${badge.cls}">${badge.texto}</span>` : ''}
        <div class="nota-meta">
          <span>${formatDateTime(n.criado_em)}</span>
        </div>
        <div class="nota-actions">
          <button class="mini secondary" style="flex:1" onclick="toggleConcluida('${n.id}', ${!n.concluida})">
            ${n.concluida ? '↩ Reabrir' : '✅ Concluir'}
          </button>
          <button class="mini" style="background:rgba(241,106,126,.12);color:var(--danger);border:1px solid rgba(241,106,126,.3)" onclick="deletarNota('${n.id}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreateNota(e) {
  e.preventDefault();
  const user = getSessionUser();

  const data = {
    titulo:          document.getElementById('notaTitulo').value.trim(),
    conteudo:        document.getElementById('notaConteudo').value.trim(),
    cor:             document.querySelector('input[name="corNota"]:checked')?.value || 'amarelo',
    data_alvo:       document.getElementById('notaData').value || null,
    fixado:          false,
    concluida:       false,
    empresa:         getEmpresaNome(),
    empresa_id:      getEmpresaAtiva(),
    criado_por:      user.id,
    criado_por_nome: user.nome,
  };

  if (!data.conteudo) { showMsg('Escreva algo na anotação.', 'error'); return; }

  try {
    await dbCreateNota(data);
    document.getElementById('formNota').reset();
    showMsg('Nota adicionada!', 'ok');
    await loadNotas();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function toggleConcluida(id, valor) {
  try {
    await dbUpdateNota(id, { concluida: valor });
    const n = allNotas.find(n => n.id === id);
    if (n) n.concluida = valor;
    renderNotas();
  } catch(e) { console.error(e); }
}

async function togglePin(id, valor) {
  try {
    await dbUpdateNota(id, { fixado: valor });
    const n = allNotas.find(n => n.id === id);
    if (n) n.fixado = valor;
    allNotas.sort((a, b) => (b.fixado - a.fixado) || String(b.criado_em).localeCompare(String(a.criado_em)));
    renderNotas();
  } catch(e) { console.error(e); }
}

async function deletarNota(id) {
  if (!confirm('Remover esta nota?')) return;
  try {
    await dbDeleteNota(id);
    showMsg('Nota removida!', 'ok');
    await loadNotas();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}
