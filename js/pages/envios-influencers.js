let allEnvios = [];
let editingEnvioId = null;

const STATUS_LABEL = {
  aguardando: '🕓 Aguardando envio',
  enviado:    '📮 Enviado',
  entregue:   '📦 Entregue',
  postou:     '🎬 Postou conteúdo',
};

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  await loadEnvios();

  document.getElementById('formEnvio').addEventListener('submit', handleCreateEnvio);
});

async function loadEnvios() {
  try {
    const empresa = getEmpresaAtiva();
    allEnvios = await dbGetEnviosInfluencers(empresa) || [];
    renderEnvios();
  } catch(e) { console.error(e); }
}

function getFilteredEnvios() {
  const q      = (document.getElementById('searchEnvio').value || '').toLowerCase().trim();
  const status = document.getElementById('filtroStatusEnvio').value;

  return allEnvios.filter(e => {
    if (status !== 'all' && e.status !== status) return false;
    if (q) {
      const haystack = [e.influencer_nome, e.rede_social, e.produtos_enviados, e.codigo_rastreio, e.whatsapp]
        .join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderEnvios() {
  const filtered = getFilteredEnvios();
  const empty = document.getElementById('enviosEmpty');
  const grid  = document.getElementById('enviosList');

  document.getElementById('countChip').innerHTML =
    `<span class="status-dot-green"></span>${allEnvios.length} envio${allEnvios.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = filtered.map(e => `
    <div class="envio-card" onclick='abrirEditEnvio(${JSON.stringify(e).replace(/'/g, "&#39;")})'>
      <div class="envio-header">
        <div>
          <div class="envio-nome">${escapeHtml(e.influencer_nome)}</div>
          ${e.rede_social ? `<div class="envio-rede">${escapeHtml(e.rede_social)}</div>` : ''}
        </div>
        <span class="envio-status-badge envio-status-${e.status}">${STATUS_LABEL[e.status] || e.status}</span>
      </div>
      <p class="envio-produtos">📦 ${escapeHtml(e.produtos_enviados)}</p>
      <div class="envio-meta">
        ${e.data_envio ? `<span>📅 ${formatDate(e.data_envio)}</span>` : ''}
        ${e.codigo_rastreio ? `<span>🔖 ${escapeHtml(e.codigo_rastreio)}</span>` : ''}
        <span>👤 ${escapeHtml(e.criado_por_nome || '—')}</span>
      </div>
      <div class="envio-actions" onclick="event.stopPropagation()">
        ${e.whatsapp ? `<button class="mini secondary" style="flex:1" onclick="openWhatsapp('${escapeAttrEnvio(e.whatsapp)}')">💬 WhatsApp</button>` : ''}
        ${e.codigo_rastreio ? `<button class="mini secondary" style="flex:1" onclick="copyText('${escapeAttrEnvio(e.codigo_rastreio)}')">📋 Copiar rastreio</button>` : ''}
        ${e.link_conteudo ? `<a href="${escapeAttrEnvio(e.link_conteudo)}" target="_blank" class="mini" style="flex:1;text-align:center;text-decoration:none">🔗 Ver post</a>` : ''}
      </div>
    </div>
  `).join('');
}

async function handleCreateEnvio(e) {
  e.preventDefault();
  const user = getSessionUser();

  const data = {
    influencer_nome:   document.getElementById('envioNome').value.trim(),
    rede_social:       document.getElementById('envioRede').value.trim(),
    whatsapp:          normalizeWhatsapp(document.getElementById('envioWhats').value),
    transportadora:    document.getElementById('envioTransportadora').value.trim(),
    endereco:          document.getElementById('envioEndereco').value.trim(),
    produtos_enviados: document.getElementById('envioProdutos').value.trim(),
    codigo_rastreio:   document.getElementById('envioRastreio').value.trim(),
    data_envio:        document.getElementById('envioData').value || null,
    status:            document.getElementById('envioStatus').value,
    link_conteudo:     document.getElementById('envioLink').value.trim(),
    observacoes:       document.getElementById('envioObs').value.trim(),
    empresa:           getEmpresaNome(),
    empresa_id:        getEmpresaAtiva(),
    criado_por:        user.id,
    criado_por_nome:   user.nome,
  };

  if (!data.influencer_nome || !data.produtos_enviados) {
    showMsg('Preencha ao menos o nome e os produtos enviados.', 'error');
    return;
  }

  try {
    await dbCreateEnvioInfluencer(data);
    document.getElementById('formEnvio').reset();
    showMsg('Envio registrado!', 'ok');
    await loadEnvios();
  } catch(err) { showMsg('Erro: ' + err.message, 'error'); }
}

// ── Editar ──
function abrirEditEnvio(e) {
  editingEnvioId = e.id;
  document.getElementById('editEnvioNome').value           = e.influencer_nome || '';
  document.getElementById('editEnvioRede').value           = e.rede_social || '';
  document.getElementById('editEnvioWhats').value          = e.whatsapp || '';
  document.getElementById('editEnvioTransportadora').value = e.transportadora || '';
  document.getElementById('editEnvioEndereco').value       = e.endereco || '';
  document.getElementById('editEnvioProdutos').value       = e.produtos_enviados || '';
  document.getElementById('editEnvioRastreio').value       = e.codigo_rastreio || '';
  document.getElementById('editEnvioData').value            = (e.data_envio || '').slice(0, 10);
  document.getElementById('editEnvioStatus').value          = e.status || 'aguardando';
  document.getElementById('editEnvioLink').value            = e.link_conteudo || '';
  document.getElementById('editEnvioObs').value              = e.observacoes || '';
  document.getElementById('editEnvioOverlay').classList.remove('hidden');
}

function fecharEditEnvio() {
  document.getElementById('editEnvioOverlay').classList.add('hidden');
  editingEnvioId = null;
}

async function salvarEditEnvio(e) {
  e.preventDefault();
  if (!editingEnvioId) return;

  const data = {
    influencer_nome:   document.getElementById('editEnvioNome').value.trim(),
    rede_social:       document.getElementById('editEnvioRede').value.trim(),
    whatsapp:          normalizeWhatsapp(document.getElementById('editEnvioWhats').value),
    transportadora:    document.getElementById('editEnvioTransportadora').value.trim(),
    endereco:          document.getElementById('editEnvioEndereco').value.trim(),
    produtos_enviados: document.getElementById('editEnvioProdutos').value.trim(),
    codigo_rastreio:   document.getElementById('editEnvioRastreio').value.trim(),
    data_envio:        document.getElementById('editEnvioData').value || null,
    status:            document.getElementById('editEnvioStatus').value,
    link_conteudo:     document.getElementById('editEnvioLink').value.trim(),
    observacoes:       document.getElementById('editEnvioObs').value.trim(),
  };

  try {
    await dbUpdateEnvioInfluencer(editingEnvioId, data);
    fecharEditEnvio();
    await loadEnvios();
  } catch(err) { alert('Erro ao salvar: ' + err.message); }
}

async function deletarEnvio() {
  if (!editingEnvioId) return;
  if (!confirm('Remover este envio?')) return;
  try {
    await dbDeleteEnvioInfluencer(editingEnvioId);
    fecharEditEnvio();
    await loadEnvios();
  } catch(err) { alert('Erro ao remover: ' + err.message); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}

function escapeAttrEnvio(val) { return String(val || '').replaceAll("'", "\\'").replaceAll('"', '&quot;'); }
