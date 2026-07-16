// ── Estado ──
let lastResults = [];
let cachedProducts = null;

const HISTORY_KEY = 'cr_link_history_v1';
const HISTORY_MAX = 100;

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();

  // Pré-carrega produtos do banco
  try {
    cachedProducts = await getAllProductsMerged();
  } catch(e) {
    console.error(e);
    cachedProducts = [];
    const err = document.getElementById('searchError');
    if (err) {
      err.textContent = 'Não foi possível carregar os produtos do banco: ' + e.message;
      err.classList.remove('hidden');
    }
  }

  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
  ['utmCampaign','utmSource','utmMedium'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input',  () => { if (lastResults.length) renderResults(lastResults); });
      el.addEventListener('change', () => { if (lastResults.length) renderResults(lastResults); });
    }
  });
  renderHistory();
});

// ── Histórico ──
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveToHistory(nome, categoria, url, campaign, source) {
  const history = getHistory();
  if (history.length && history[0].url === url) return;
  history.unshift({ nome, categoria, url, campaign, source, criadoEm: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));

  // Salva no Supabase também
  if (isSupabaseReady()) {
    const user = getSessionUser();
    dbSaveHistoricoLink({
      nome_produto: nome, categoria, url, campaign, source,
      usuario_id:   user?.id || null,
      usuario_nome: user?.nome || '',
      empresa_id:   getEmpresaAtiva(),
    }).catch(console.error);
    // stat de "melhores links" removida (página não é mais usada)
  }
  renderHistory();
}

function clearHistory() {
  if (!confirm('Limpar todo o histórico de links?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function renderHistory() {
  const section = document.getElementById('historySection');
  const list    = document.getElementById('historyList');
  if (!section || !list) return;
  const history = getHistory();
  if (!history.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  list.innerHTML = history.map((item, idx) => `
    <div class="hist-row">
      <div class="hist-info">
        <span class="hist-nome">${escapeHtml(item.nome)}</span>
        <div class="hist-meta">
          <span class="hist-tag">${escapeHtml(item.campaign || '—')}</span>
          <span class="hist-tag">${escapeHtml(item.source || '—')}</span>
          <span class="hist-date">${formatHistDate(item.criadoEm)}</span>
        </div>
        <div class="hist-url">${escapeHtml(item.url)}</div>
      </div>
      <button class="btn-copy hist-copy" data-url="${escapeHtml(item.url)}" onclick="copyHistLink(this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
    </div>
  `).join('');
}

function formatHistDate(iso) {
  try { return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch { return ''; }
}

function copyHistLink(btn) {
  navigator.clipboard.writeText(btn.dataset.url).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>Copiado!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar`;
    }, 2000);
  });
}

// ── Busca local por similaridade ──
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function score(product, query) {
  const name  = normalize(product.nome);
  const cat   = normalize(product.categoria);
  const q     = normalize(query);
  const words = q.split(' ').filter(Boolean);
  if (name.includes(q)) return 100;
  let pts = 0;
  words.forEach(w => {
    if (name.includes(w)) pts += 20;
    if (cat.includes(w))  pts += 8;
    name.split(' ').forEach(part => { if (part.startsWith(w) && w.length >= 3) pts += 10; });
  });
  const numMatch = q.match(/\d+/);
  if (numMatch) {
    const num = numMatch[0];
    if (name.includes(num + ' ') || name.startsWith(num)) pts += 15;
  }
  return pts;
}

function searchLocal(query) {
  if (!query.trim()) return [];
  const prods = cachedProducts || [];
  return prods
    .map(p => ({ ...p, _score: score(p, query) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)
    .map(p => ({
      nome: p.nome, link: p.link_yampi, categoria: p.categoria,
      relevancia: p._score >= 40 ? 'Alta' : p._score >= 15 ? 'Média' : 'Baixa',
      motivo: `Categoria: ${p.categoria}`
    }));
}

// ── Monta URL com UTMs ──
function buildLink(baseUrl) {
  const campaign = document.getElementById('utmCampaign').value.trim();
  const source   = document.getElementById('utmSource').value.trim() || 'reportana';
  const medium   = document.getElementById('utmMedium').value.trim() || 'whatsapp';
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return { full: u.toString(), source, medium, campaign };
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    let url = `${baseUrl}${sep}utm_source=${source}&utm_medium=${medium}`;
    if (campaign) url += `&utm_campaign=${campaign}`;
    return { full: url, source, medium, campaign };
  }
}

// ── Buscar ──
async function doSearch() {
  const q        = document.getElementById('searchInput').value.trim();
  const campaign = document.getElementById('utmCampaign').value;
  if (!q) return;

  if (!campaign) {
    document.getElementById('noCampWarn').classList.remove('hidden');
    document.getElementById('utmCampaign').focus();
    return;
  }

  document.getElementById('noCampWarn').classList.add('hidden');
  document.getElementById('searchError').classList.add('hidden');
  document.getElementById('resultsList').innerHTML = '';
  document.getElementById('noResultsEl').classList.add('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('btnSearch').disabled = true;

  // Recarrega produtos se necessário
  if (!cachedProducts) {
    try {
      cachedProducts = await getAllProductsMerged();
    } catch(e) {
      console.error(e);
      document.getElementById('searchError').textContent = 'Não foi possível carregar os produtos do banco: ' + e.message;
      document.getElementById('searchError').classList.remove('hidden');
      document.getElementById('btnSearch').disabled = false;
      return;
    }
  }

  lastResults = searchLocal(q);

  if (!lastResults.length) {
    document.getElementById('noResultsEl').classList.remove('hidden');
  } else {
    renderResults(lastResults);
  }
  document.getElementById('btnSearch').disabled = false;
}

// ── Renderiza resultados ──
function renderResults(results) {
  const list = document.getElementById('resultsList');
  list.innerHTML = '';
  results.forEach(item => {
    if (!item.link) return;
    const utm      = buildLink(item.link);
    const relClass = item.relevancia === 'Alta' ? 'alta' : item.relevancia === 'Média' ? 'media' : 'baixa';
    const chips = [
      { k: 'utm_source',   v: utm.source },
      { k: 'utm_medium',   v: utm.medium },
      ...(utm.campaign ? [{ k: 'utm_campaign', v: utm.campaign }] : []),
    ].map(p => `<div class="utm-chip"><div class="ck">${escapeHtml(p.k)}</div><div class="cv">${escapeHtml(p.v)}</div></div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="rc-header">
        <span class="rc-name">${escapeHtml(item.nome || 'Produto')}</span>
        <span class="rc-rel ${relClass}">${escapeHtml(item.relevancia || 'Alta')}</span>
      </div>
      ${item.motivo ? `<p class="rc-motivo">${escapeHtml(item.motivo)}</p>` : ''}
      <div class="utm-chips">${chips}</div>
      <div class="link-box">
        <div class="lb-label">Link final com UTMs</div>
        <div class="lb-url">${escapeHtml(utm.full)}</div>
      </div>
      <button class="btn-copy"
        data-nome="${escapeHtml(item.nome||'')}"
        data-cat="${escapeHtml(item.categoria||'')}"
        data-url="${escapeHtml(utm.full)}"
        data-campaign="${escapeHtml(utm.campaign)}"
        data-source="${escapeHtml(utm.source)}"
        onclick="copyLink(this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar link
      </button>
    `;
    list.appendChild(card);
  });
}

// ── Copia e salva histórico ──
function copyLink(btn) {
  navigator.clipboard.writeText(btn.dataset.url).then(() => {
    if (btn.dataset.nome) {
      saveToHistory(btn.dataset.nome, btn.dataset.cat, btn.dataset.url, btn.dataset.campaign, btn.dataset.source);
    }
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>Copiado!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar link`;
    }, 2200);
  });
}
