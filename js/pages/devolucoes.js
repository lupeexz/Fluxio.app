let allDevolucoes = [];
let editingDevolucaoId = null;

const MOTIVO_LABEL = {
  duplicidade:        '📦 Duplicidade',
  recusado:            '🚫 Recusado pelo cliente',
  endereco_incorreto: '📍 Endereço incorreto',
  nao_retirado:        '⏳ Não retirado',
  avaria:              '💥 Avaria',
  outro:                '❓ Outro',
};

const STATUS_LABEL_DEV = {
  aguardando_analise:  '🕓 Aguardando análise',
  reintegrado_estoque: '📥 Reintegrado ao estoque',
  reenviado:            '📮 Reenviado',
  reembolsado:          '💸 Reembolsado',
  descartado:           '🗑️ Descartado',
};

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  await loadDevolucoes();

  document.getElementById('formDevolucao').addEventListener('submit', handleCreateDevolucao);
});

async function loadDevolucoes() {
  try {
    const empresa = getEmpresaAtiva();
    allDevolucoes = await dbGetDevolucoes(empresa) || [];
    renderDevolucoes();
  } catch(e) { console.error(e); }
}

function getFilteredDevolucoes() {
  const q      = (document.getElementById('searchDevolucao').value || '').toLowerCase().trim();
  const status = document.getElementById('filtroStatusDevolucao').value;
  const motivo = document.getElementById('filtroMotivoDevolucao').value;

  return allDevolucoes.filter(d => {
    if (status !== 'all' && d.status !== status) return false;
    if (motivo !== 'all' && d.motivo !== motivo) return false;
    if (q) {
      const haystack = [d.cliente_nome, d.numero_pedido, d.produtos, d.codigo_rastreio, d.whatsapp]
        .join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderDevolucoes() {
  const filtered = getFilteredDevolucoes();
  const empty = document.getElementById('devolucoesEmpty');
  const grid  = document.getElementById('devolucoesList');

  document.getElementById('countChip').innerHTML =
    `<span class="status-dot-green"></span>${allDevolucoes.length} devolu${allDevolucoes.length !== 1 ? 'ções' : 'ção'}`;

  if (!filtered.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = filtered.map(d => `
    <div class="envio-card" onclick='abrirEditDevolucao(${JSON.stringify(d).replace(/'/g, "&#39;")})'>
      <div class="envio-header">
        <div>
          <div class="envio-nome">${escapeHtml(d.cliente_nome)}</div>
          ${d.numero_pedido ? `<div class="envio-rede">Pedido ${escapeHtml(d.numero_pedido)}</div>` : ''}
        </div>
        <span class="envio-status-badge envio-status-${statusCorDevolucao(d.status)}">${STATUS_LABEL_DEV[d.status] || d.status}</span>
      </div>
      <p class="envio-produtos">📦 ${escapeHtml(d.produtos)}</p>
      <div class="envio-meta">
        <span>${MOTIVO_LABEL[d.motivo] || d.motivo}</span>
        ${d.data_retorno ? `<span>📅 ${formatDate(d.data_retorno)}</span>` : ''}
        ${d.valor ? `<span>💰 R$ ${Number(d.valor).toFixed(2)}</span>` : ''}
      </div>
      <div class="envio-actions" onclick="event.stopPropagation()">
        ${d.whatsapp ? `<button class="mini secondary" style="flex:1" onclick="openWhatsapp('${escapeAttrDevolucao(d.whatsapp)}')">💬 WhatsApp</button>` : ''}
        ${d.codigo_rastreio ? `<button class="mini secondary" style="flex:1" onclick="copyText('${escapeAttrDevolucao(d.codigo_rastreio)}')">📋 Copiar rastreio</button>` : ''}
      </div>
    </div>
  `).join('');
}

function statusCorDevolucao(status) {
  if (status === 'aguardando_analise')  return 'aguardando';
  if (status === 'reintegrado_estoque') return 'entregue';
  if (status === 'reenviado')            return 'enviado';
  if (status === 'reembolsado')          return 'postou';
  if (status === 'descartado')           return 'descartado';
  return 'aguardando';
}

async function handleCreateDevolucao(e) {
  e.preventDefault();
  const user = getSessionUser();

  const data = {
    numero_pedido:   document.getElementById('devNumeroPedido').value.trim(),
    cliente_nome:    document.getElementById('devClienteNome').value.trim(),
    whatsapp:        normalizeWhatsapp(document.getElementById('devWhats').value),
    produtos:        document.getElementById('devProdutos').value.trim(),
    motivo:          document.getElementById('devMotivo').value,
    transportadora:  document.getElementById('devTransportadora').value.trim(),
    codigo_rastreio: document.getElementById('devRastreio').value.trim(),
    data_retorno:    document.getElementById('devData').value || null,
    valor:           document.getElementById('devValor').value ? Number(document.getElementById('devValor').value) : null,
    status:          document.getElementById('devStatus').value,
    observacoes:     document.getElementById('devObs').value.trim(),
    empresa:         getEmpresaNome(),
    empresa_id:      getEmpresaAtiva(),
    criado_por:      user.id,
    criado_por_nome: user.nome,
  };

  if (!data.cliente_nome || !data.produtos) {
    showMsg('Preencha ao menos o nome do cliente e os produtos.', 'error');
    return;
  }

  try {
    await dbCreateDevolucao(data);
    document.getElementById('formDevolucao').reset();
    showMsg('Devolução registrada!', 'ok');
    await loadDevolucoes();
  } catch(err) { showMsg('Erro: ' + err.message, 'error'); }
}

// ── Editar ──
function abrirEditDevolucao(d) {
  editingDevolucaoId = d.id;
  document.getElementById('editDevNumeroPedido').value  = d.numero_pedido || '';
  document.getElementById('editDevClienteNome').value   = d.cliente_nome || '';
  document.getElementById('editDevWhats').value          = d.whatsapp || '';
  document.getElementById('editDevProdutos').value       = d.produtos || '';
  document.getElementById('editDevMotivo').value          = d.motivo || 'outro';
  document.getElementById('editDevTransportadora').value = d.transportadora || '';
  document.getElementById('editDevRastreio').value       = d.codigo_rastreio || '';
  document.getElementById('editDevData').value            = (d.data_retorno || '').slice(0, 10);
  document.getElementById('editDevValor').value            = d.valor || '';
  document.getElementById('editDevStatus').value          = d.status || 'aguardando_analise';
  document.getElementById('editDevObs').value              = d.observacoes || '';
  document.getElementById('editDevolucaoOverlay').classList.remove('hidden');
}

function fecharEditDevolucao() {
  document.getElementById('editDevolucaoOverlay').classList.add('hidden');
  editingDevolucaoId = null;
}

async function salvarEditDevolucao(e) {
  e.preventDefault();
  if (!editingDevolucaoId) return;

  const data = {
    numero_pedido:   document.getElementById('editDevNumeroPedido').value.trim(),
    cliente_nome:    document.getElementById('editDevClienteNome').value.trim(),
    whatsapp:        normalizeWhatsapp(document.getElementById('editDevWhats').value),
    produtos:        document.getElementById('editDevProdutos').value.trim(),
    motivo:          document.getElementById('editDevMotivo').value,
    transportadora:  document.getElementById('editDevTransportadora').value.trim(),
    codigo_rastreio: document.getElementById('editDevRastreio').value.trim(),
    data_retorno:    document.getElementById('editDevData').value || null,
    valor:           document.getElementById('editDevValor').value ? Number(document.getElementById('editDevValor').value) : null,
    status:          document.getElementById('editDevStatus').value,
    observacoes:     document.getElementById('editDevObs').value.trim(),
  };

  try {
    await dbUpdateDevolucao(editingDevolucaoId, data);
    fecharEditDevolucao();
    await loadDevolucoes();
  } catch(err) { alert('Erro ao salvar: ' + err.message); }
}

async function deletarDevolucao() {
  if (!editingDevolucaoId) return;
  if (!confirm('Remover esta devolução?')) return;
  try {
    await dbDeleteDevolucao(editingDevolucaoId);
    fecharEditDevolucao();
    await loadDevolucoes();
  } catch(err) { alert('Erro ao remover: ' + err.message); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}

function escapeAttrDevolucao(val) { return String(val || '').replaceAll("'", "\\'").replaceAll('"', '&quot;'); }
