let allClientes = [];

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  await loadClientes();

  document.getElementById('formCliente').addEventListener('submit', handleCreate);
});

function hojeStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadClientes() {
  try {
    const empresa = getEmpresaAtiva();
    allClientes = await dbGetClientesPendentes(empresa) || [];
    renderClientes();
  } catch(e) {
    console.error(e);
  }
}

function renderClientes() {
  const hoje = hojeStr();
  const list  = document.getElementById('clientesList');
  const empty = document.getElementById('clientesEmpty');
  const chip  = document.getElementById('countChip');

  // Ordena: atrasados primeiro, depois hoje, depois futuros
  const sorted = [...allClientes].sort((a, b) => a.data_combinada.localeCompare(b.data_combinada));

  chip.innerHTML = `<span class="status-dot-green"></span>${sorted.length} cliente${sorted.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = sorted.map(c => {
    const atrasado = c.data_combinada < hoje;
    const ehHoje    = c.data_combinada === hoje;
    const cardCls   = atrasado ? 'cliente-atrasado' : ehHoje ? 'cliente-hoje' : '';
    const badgeCls  = atrasado ? 'cliente-badge-atrasado' : ehHoje ? 'cliente-badge-hoje' : 'cliente-badge-normal';
    const badgeTxt  = atrasado ? '⚠️ Atrasado' : ehHoje ? '🔔 Hoje' : formatDate(c.data_combinada);

    return `
      <div class="cliente-card ${cardCls}">
        <div class="cliente-header">
          <div>
            <div class="cliente-nome">${escapeHtml(c.nome)}</div>
            <div class="cliente-whats">${escapeHtml(c.whatsapp)}</div>
          </div>
          <span class="cliente-badge-data ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="cliente-meta">
          <span>🧴 ${c.quantidade_frascos} frasco${c.quantidade_frascos !== 1 ? 's' : ''}</span>
          <span>📅 ${formatDate(c.data_combinada)}</span>
          <span>📝 ${escapeHtml(c.criado_por_nome || '—')}</span>
        </div>
        ${c.observacao ? `<p class="cliente-obs">${escapeHtml(c.observacao)}</p>` : ''}
        <div class="cliente-actions">
          <button class="mini secondary" onclick="openWhatsapp('${escapeAttrCli(c.whatsapp)}')" style="flex:1">💬 Abrir WhatsApp</button>
          <button class="mini" onclick="marcarChamado('${c.id}','${escapeAttrCli(c.nome)}')" style="flex:1;background:var(--ok)">✓ Chamado</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreate(e) {
  e.preventDefault();
  const user = getSessionUser();

  const data = {
    nome:                document.getElementById('clienteNome').value.trim(),
    whatsapp:            normalizeWhatsapp(document.getElementById('clienteWhats').value),
    quantidade_frascos:  parseInt(document.getElementById('clienteFrascos').value) || 1,
    data_combinada:      document.getElementById('clienteData').value,
    observacao:          document.getElementById('clienteObs').value.trim(),
    empresa:             getEmpresaNome(),
    empresa_id:          getEmpresaAtiva(),
    criado_por:          user.id,
    criado_por_nome:     user.nome,
  };

  if (!data.nome || !data.whatsapp || !data.data_combinada) {
    showMsg('Preencha nome, WhatsApp e data.', 'error');
    return;
  }

  try {
    await dbCreateClientePendente(data);
    document.getElementById('formCliente').reset();
    showMsg('Cliente agendado!', 'ok');
    await loadClientes();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function marcarChamado(id, nome) {
  if (!confirm(`Marcar "${nome}" como chamado? Ele sairá da lista.`)) return;
  try {
    await dbDeleteClientePendente(id);
    showMsg('Cliente removido da lista!', 'ok');
    await loadClientes();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}

function escapeAttrCli(val) { return String(val || '').replaceAll("'", "\\'").replaceAll('"', '&quot;'); }
