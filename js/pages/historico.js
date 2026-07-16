let allHistorico = [];

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  await loadHistorico();

  ['filterSearch', 'filterCampaign', 'filterSource', 'filterUsuario'].forEach(id => {
    document.getElementById(id).addEventListener('input',  renderHistory);
    document.getElementById(id).addEventListener('change', renderHistory);
  });
});

// ── Carrega do banco (compartilhado com o time inteiro) ──
async function loadHistorico() {
  const loading = document.getElementById('loadingHist');
  try {
    allHistorico = await dbGetHistoricoLinks(500) || [];
  } catch(e) {
    console.error(e);
    allHistorico = [];
  }
  loading.classList.add('hidden');
  populateFilters();
  renderHistory();
}

// ── Popula dropdowns de filtro com valores únicos do histórico ──
function populateFilters() {
  const campaigns = [...new Set(allHistorico.map(h => h.campaign).filter(Boolean))].sort();
  const sources   = [...new Set(allHistorico.map(h => h.source).filter(Boolean))].sort();
  const usuarios  = [...new Set(allHistorico.map(h => h.usuario_nome).filter(Boolean))].sort();

  const campSel = document.getElementById('filterCampaign');
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    campSel.appendChild(opt);
  });

  const srcSel = document.getElementById('filterSource');
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    srcSel.appendChild(opt);
  });

  const userSel = document.getElementById('filterUsuario');
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    userSel.appendChild(opt);
  });
}

// ── Filtra registros ──
function getFiltered() {
  const q        = document.getElementById('filterSearch').value.toLowerCase().trim();
  const campaign = document.getElementById('filterCampaign').value;
  const source   = document.getElementById('filterSource').value;
  const usuario  = document.getElementById('filterUsuario').value;

  return allHistorico.filter(item => {
    if (campaign && item.campaign !== campaign) return false;
    if (source   && item.source   !== source)   return false;
    if (usuario  && item.usuario_nome !== usuario) return false;
    if (q) {
      const hay = [item.nome_produto, item.categoria, item.campaign, item.source, item.usuario_nome, item.url]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── Renderiza tabela ──
function renderHistory() {
  const items = getFiltered();
  const empty = document.getElementById('emptyHist');
  const card  = document.getElementById('histCard');
  const body  = document.getElementById('histBody');
  const chip  = document.getElementById('countChip');

  chip.innerHTML = `<span class="status-dot-green"></span>${allHistorico.length} link${allHistorico.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    empty.classList.remove('hidden');
    card.style.display = 'none';
    body.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  card.style.display = 'block';

  body.innerHTML = items.map((item, idx) => `
    <tr>
      <td style="color:var(--muted);font-size:12px">${idx + 1}</td>
      <td style="font-weight:600;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.nome_produto || '—')}</td>
      <td><span class="pill">${escapeHtml(item.categoria || '—')}</span></td>
      <td style="font-size:12px">${escapeHtml(item.campaign || '—')}</td>
      <td style="font-size:12px">${escapeHtml(item.source || '—')}</td>
      <td style="font-size:12px">${escapeHtml(item.usuario_nome || '—')}</td>
      <td style="font-size:12px;white-space:nowrap;color:var(--muted)">${formatDate(item.criado_em)}</td>
      <td style="max-width:260px">
        <div style="font-size:10px;color:var(--brand);font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.url || '')}</div>
      </td>
      <td class="actions">
        <button class="mini secondary" onclick="copyUrl('${escapeAttr(item.url)}', this)">Copiar</button>
      </td>
    </tr>
  `).join('');
}

// ── Copia URL ──
function copyUrl(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copiado!';
    btn.style.color = 'var(--ok)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}

// ── Limpa histórico (admin) ──
async function clearHistory() {
  if (!confirm('Limpar TODO o histórico de links do time? Esta ação não pode ser desfeita.')) return;
  try {
    await sbFetch('historico_links?id=not.is.null', { method: 'DELETE', prefer: '' });
    await loadHistorico();
  } catch(e) {
    alert('Erro ao limpar: ' + e.message);
  }
}

// ── Exporta CSV ──
function exportCsv() {
  const items = getFiltered();
  if (!items.length) return;

  const headers = ['#', 'Produto', 'Categoria', 'Campanha', 'Source', 'Gerado por', 'Data/Hora', 'Link'];
  const rows = items.map((item, idx) => [
    idx + 1,
    item.nome_produto || '',
    item.categoria    || '',
    item.campaign     || '',
    item.source       || '',
    item.usuario_nome || '',
    formatDate(item.criado_em),
    item.url          || '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historico-links-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ──
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

function escapeAttr(val) {
  return String(val || '').replaceAll("'", "\\'").replaceAll('"', '&quot;');
}
