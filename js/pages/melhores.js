const COPY_STATS_KEY = 'cr_link_copy_stats_v1';

// ── Lê contagem do localStorage ──
function getStats() {
  try {
    return JSON.parse(localStorage.getItem(COPY_STATS_KEY) || '{}');
  } catch { return {}; }
}

function saveStats(stats) {
  localStorage.setItem(COPY_STATS_KEY, JSON.stringify(stats));
}

function incrementStat(nome) {
  const stats = getStats();
  stats[nome] = (stats[nome] || 0) + 1;
  saveStats(stats);
}

// ── Retorna os N mais copiados ──
function getTopProducts(n = 6) {
  const stats = getStats();
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([nome, count]) => {
      const product = (window._PRODUCTS_MERGED || PRODUCTS).find(p => p.nome === nome);
      return product ? { ...product, count } : null;
    })
    .filter(Boolean);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  showUserInfo();
  renderBest();
  ['utmCampaign','utmSource','utmMedium'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input',  renderBest);
      el.addEventListener('change', renderBest);
    }
  });
});

function buildLink(baseUrl) {
  const campaign = document.getElementById('utmCampaign').value.trim();
  const source   = document.getElementById('utmSource').value.trim()   || 'reportana_3938';
  const medium   = document.getElementById('utmMedium').value.trim()   || 'whatsapp';
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    let url = `${baseUrl}${sep}utm_source=${source}&utm_medium=${medium}`;
    if (campaign) url += `&utm_campaign=${campaign}`;
    return url;
  }
}

async function renderBest() {
  const grid = document.getElementById('bestGrid');
  const emptyState = document.getElementById('bestEmpty');
  if (!grid) return;

  // Atualiza PRODUCTS global com dados do banco
  try {
    const merged = await getAllProductsMerged();
    window._PRODUCTS_MERGED = merged;
  } catch { window._PRODUCTS_MERGED = PRODUCTS; }

  const top = getTopProducts(6);

  if (!top.length) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = top.map((p, i) => {
    const fullUrl = buildLink(p.link_yampi);
    const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    return `
      <div class="best-card">
        <div class="best-header">
          <span class="best-rank">${medal}</span>
          <span class="best-count">${p.count} ${p.count === 1 ? 'cópia' : 'cópias'}</span>
        </div>
        <div class="best-cat">${escapeHtml(p.categoria)}</div>
        <div class="best-name">${escapeHtml(p.nome)}</div>
        <div class="best-url">${escapeHtml(fullUrl)}</div>
        <button class="btn-copy" data-nome="${escapeHtml(p.nome)}" data-url="${escapeHtml(fullUrl)}" onclick="copyLink(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar link
        </button>
      </div>
    `;
  }).join('');
}

function copyLink(btn) {
  const url  = btn.dataset.url;
  const nome = btn.dataset.nome;
  navigator.clipboard.writeText(url).then(() => {
    if (nome) incrementStat(nome);
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>Copiado!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar link`;
      renderBest(); // atualiza ranking após copiar
    }, 2200);
  });
}
