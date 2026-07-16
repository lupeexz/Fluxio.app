const $ = (id) => document.getElementById(id);

const RECORDS_CACHE_KEY = "reenvios_estornos_records_cache_v5";
const RECORDS_CACHE_TIME = 5 * 60 * 1000;
const PROFILE_KEY = 'fluxio_profile_v1';

// ── Auth (Supabase Auth real) ──
function getSessionUser() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
  catch { return null; }
}

function getEmpresaAtiva() {
  return getSessionUser()?.empresa_id || null;
}

function getEmpresaNome() {
  return getSessionUser()?.empresa_nome || '';
}

// Iniciais da loja (mantido por compatibilidade, usado em outros lugares)
function lojaInitials(nome) {
  return (nome || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

// Busca o perfil (empresa + role + nome) do usuário logado e guarda em cache local
async function carregarPerfil() {
  const perfil = await dbGetMeuPerfil();
  if (!perfil) return null;
  const session = getAuthSession();
  const cache = {
    id:           perfil.id,
    nome:         perfil.nome,
    email:        perfil.email || session?.user?.email || '',
    role:         perfil.role,
    ativo:        perfil.ativo,
    empresa_id:   perfil.empresa_id,
    empresa_nome: perfil.empresas?.nome || '',
    empresa_slug: perfil.empresas?.slug || '',
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(cache));
  return cache;
}

function isAuthenticated() {
  return isLoggedIn();
}

async function requireAuth() {
  if (!isLoggedIn()) {
    const inSubPage = window.location.pathname.includes('/pages/');
    window.location.href = inSubPage ? '../index.html' : 'index.html';
    return;
  }
  // Garante que o perfil (empresa/role) está em cache antes da página seguir
  if (!getSessionUser()) {
    try {
      const perfil = await carregarPerfil();
      if (!perfil) throw new Error('Perfil não encontrado.');
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      const inSubPage = window.location.pathname.includes('/pages/');
      window.location.href = inSubPage ? '../index.html' : 'index.html';
    }
  }
}

function isAdmin() {
  return getSessionUser()?.role === 'admin';
}

function logout() {
  authSignOut().finally(() => {
    localStorage.removeItem(PROFILE_KEY);
    const inSubPage = window.location.pathname.includes('/pages/');
    window.location.href = inSubPage ? '../index.html' : 'index.html';
  });
}

// Mostra nome do usuário logado nos elementos .user-name-display
function showUserInfo() {
  const user = getSessionUser();
  if (!user) return;
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.nome || '');
  document.querySelectorAll('.user-role-display').forEach(el => {
    el.textContent = user.role === 'admin' ? 'Admin' : 'Atendente';
  });
  // Esconde itens admin-only se não for admin
  if (user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  // Carrega badge de pendências
  loadPendingBadge();
  // Atualiza ícone do tema
  updateThemeToggleIcon(getTheme());
  // Verifica novas tarefas e notifica
  setTimeout(checkNovasTarefas, 1500);

}

// ── SHA-256 ──
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Cache de registros ──
function readCachedRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    localStorage.removeItem(RECORDS_CACHE_KEY);
    return [];
  }
}

function isCacheFresh() {
  try {
    const raw = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Date.now() - Number(parsed.time || 0) < RECORDS_CACHE_TIME;
  } catch { return false; }
}

function saveCachedRecords(records) {
  localStorage.setItem(RECORDS_CACHE_KEY, JSON.stringify({ time: Date.now(), records: Array.isArray(records) ? records : [] }));
}

function clearRecordsCache() {
  localStorage.removeItem(RECORDS_CACHE_KEY);
}

// ── API Records (Google Sheets fallback + Supabase) ──
async function fetchRecordsFromApi() {
  if (isSupabaseReady()) {
    const empresa = getEmpresaAtiva();
    const isAdm   = getSessionUser()?.role === 'admin';
    const rows = isAdm
      ? await dbGetRegistros()
      : await dbGetRegistrosByEmpresa(empresa);
    const records = (rows || []).map(r => ({
      id:                 r.id,
      criadoEm:           r.criado_em,
      tipo:               r.tipo,
      loja:               r.loja,
      empresa:            r.empresa,
      dataPedido:         r.data_pedido,
      motivo:             r.motivo,
      fretesEstorno:      r.fretes_estorno,
      numeroPedido:       r.numero_pedido,
      whatsapp:           r.whatsapp,
      dataReenvio:        r.data_reenvio,
      novoCodigoRastreio: r.novo_codigo_rastreio,
      usuarioNome:        r.usuario_nome,
    }));
    saveCachedRecords(records);
    return records;
  }
  // Fallback Google Sheets
  const url = new URL(CONFIG.WEB_APP_URL);
  url.searchParams.set("action", "list");
  url.searchParams.set("token", CONFIG.FORM_TOKEN);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const result   = await response.json();
  if (!result.ok && !result.success) throw new Error(result.error || "Erro ao carregar.");
  const records = result.records || [];
  saveCachedRecords(records);
  return records;
}

async function apiGetRecords(options = {}) {
  const force = Boolean(options.force);
  if (!force) {
    const cached = readCachedRecords();
    if (cached.length) {
      if (!isCacheFresh() && options.background) fetchRecordsFromApi().catch(console.error);
      return cached;
    }
  }
  return fetchRecordsFromApi();
}

async function apiRefreshRecords() { return fetchRecordsFromApi(); }

async function apiCreateRecord(payload) {
  // Se Supabase configurado, salva lá
  if (isSupabaseReady()) {
    const user = getSessionUser();
    await dbCreateRegistro({
      tipo:               payload.tipo,
      loja:               payload.loja,
      empresa:            payload.empresa,
      empresa_id:         payload.empresa_id,
      data_pedido:        payload.dataPedido || null,
      motivo:             payload.motivo,
      fretes_estorno:     payload.fretesEstorno,
      numero_pedido:      payload.numeroPedido,
      whatsapp:           payload.whatsapp,
      novo_codigo_rastreio: payload.novoCodigoRastreio,
      data_reenvio:       payload.dataReenvio || null,
      usuario_id:         user?.id || null,
      usuario_nome:       user?.nome || 'Sistema',
    });
    clearRecordsCache();
    return { ok: true };
  }
  // Fallback Google Sheets
  const response = await fetch(CONFIG.WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, action: "create", token: CONFIG.FORM_TOKEN }),
  });
  const result = await response.json();
  if (!result.ok && !result.success) throw new Error(result.error || "Erro ao salvar.");
  clearRecordsCache();
  return result;
}

// ── Helpers ──
function normalizeWhatsapp(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : escapeHtml(value);
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? escapeHtml(value) : d.toLocaleString("pt-BR");
}

function parseBRL(value) {
  if (!value && value !== 0) return 0;
  let text = String(value).trim().replace("R$", "").replace(/\s/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (text.split(".").length > 2) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function openWhatsapp(number) {
  const phone = String(number || "").replace(/\D/g, "");
  if (phone) window.open(`https://wa.me/55${phone}`, "_blank");
}

function copyText(text) {
  navigator.clipboard.writeText(String(text || ""));
}

// ── Badge de solicitações pendentes (admin only) ──
async function loadPendingBadge() {
  if (!isSupabaseReady()) return;
  try {
    // Badge de solicitações (admin)
    if (isAdmin()) {
      const all  = await dbGetUsuarios();
      const pend = (all || []).filter(u => !u.ativo).length;
      const badge = document.getElementById('pendBadge');
      if (badge) {
        badge.textContent = pend;
        badge.classList.toggle('hidden', pend === 0);
      }
    }

    // Badge de tarefas (todos)
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();
    let query = `tarefas?status=eq.pendente&empresa_id=eq.${empresa}`;
    if (!isAdmin()) query += `&atribuido_para=eq.${user.id}`;
    const tarefas = await sbFetch(query);
    const tBadge  = document.getElementById('tarefasBadge');
    if (tBadge) {
      const count = (tarefas || []).length;
      tBadge.textContent = count;
      tBadge.classList.toggle('hidden', count === 0);
    }
  } catch(e) { console.error(e); }
}

// ── Toast de notificação ──
function showToast(msg, type = 'info', duration = 5000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'tarefa' ? '📋' : type === 'ok' ? '✓' : 'ℹ️'}</div>
    <div class="toast-body">
      <div class="toast-titulo">Nova tarefa atribuída</div>
      <div class="toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Verifica novas tarefas e notifica ──
const TAREFAS_VISTAS_KEY = 'cr_tarefas_vistas_v1';

function getTarefasVistas() {
  try { return JSON.parse(localStorage.getItem(TAREFAS_VISTAS_KEY) || '[]'); }
  catch { return []; }
}

function marcarTarefaVista(id) {
  const vistas = getTarefasVistas();
  if (!vistas.includes(id)) {
    vistas.push(id);
    localStorage.setItem(TAREFAS_VISTAS_KEY, JSON.stringify(vistas.slice(-200)));
  }
}

async function checkNovasTarefas() {
  if (!isSupabaseReady() || !isAuthenticated()) return;

  // Detecta o tipo de navegação: 'navigate' (clique em link), 'reload' (F5), 'back_forward'
  const navEntries = performance.getEntriesByType('navigation');
  const navType = navEntries[0]?.type || 'navigate';

  // Só notifica em reload ou primeira entrada (login). Navegação por clique em link não notifica de novo.
  const isFreshLoad = navType === 'reload' || !sessionStorage.getItem('cr_session_started');

  if (!sessionStorage.getItem('cr_session_started')) {
    sessionStorage.setItem('cr_session_started', '1');
  }

  if (!isFreshLoad) return;

  try {
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();

    const tarefas = await sbFetch(
      `tarefas?atribuido_para=eq.${user.id}&empresa_id=eq.${empresa}&status=eq.pendente&order=criado_em.desc&limit=10`
    );

    (tarefas || []).forEach((t, i) => {
      setTimeout(() => showToast(t.titulo, 'tarefa'), i * 300);
    });
  } catch(e) { console.error(e); }

  // ── Alerta de clientes pendentes (atrasados ou hoje) ──
  try {
    const empresa = getEmpresaAtiva();
    const hoje = new Date().toISOString().slice(0, 10);

    const clientes = await sbFetch(
      `clientes_pendentes?select=*&empresa_id=eq.${empresa}&data_combinada=lte.${hoje}`
    );

    const atrasados = (clientes || []).filter(c => c.data_combinada < hoje).length;
    const pendHoje  = (clientes || []).filter(c => c.data_combinada === hoje).length;

    if (atrasados > 0) {
      setTimeout(() => showToast(`${atrasados} cliente${atrasados > 1 ? 's' : ''} atrasado${atrasados > 1 ? 's' : ''} pra chamar!`, 'tarefa'), 600);
    } else if (pendHoje > 0) {
      setTimeout(() => showToast(`${pendHoje} cliente${pendHoje > 1 ? 's' : ''} pra chamar hoje!`, 'tarefa'), 600);
    }
  } catch(e) { console.error(e); }
}

// ── Tema (claro/escuro) ──
const THEME_KEY = 'cr_theme_v1';
const ICON_SUN  = '☀️';
const ICON_MOON = '🌙';
const ICON_GEAR = '⚙️';
const ICON_SEARCH = '🔍';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleIcon(theme);
}

function toggleTheme() {
  const current = getTheme();
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function updateThemeToggleIcon(theme) {
  const btn = document.getElementById('globalThemeBtn');
  if (btn) btn.textContent = theme === 'light' ? ICON_SUN : ICON_MOON;
}

// Aplica tema salvo assim que o script carrega (evita flash)
applyTheme(getTheme());

// ── Topbar global fixa (busca + tema + configurações) ──
function injectGlobalTopbar() {
  if (document.getElementById('globalTopbar')) return;
  if (!isAuthenticated()) return; // Não mostra na tela de login

  const inSubPage = window.location.pathname.includes('/pages/');
  const contaHref = inSubPage ? 'conta.html' : 'pages/conta.html';
  const isOnConta = window.location.pathname.includes('conta.html');

  const bar = document.createElement('div');
  bar.id = 'globalTopbar';
  bar.innerHTML = `
    <button id="globalSearchBtn" class="gtb-search-btn" onclick="openGlobalSearch()">
      <span>${ICON_SEARCH}</span>
      <span>Buscar...</span>
      <kbd>Ctrl K</kbd>
    </button>
    <button id="globalBellBtn" class="gtb-theme-btn gtb-bell-btn" onclick="toggleNotifPanel()" title="Notificações">
      🔔
      <span id="globalBellBadge" class="gtb-bell-badge hidden">0</span>
    </button>
    <button id="globalThemeBtn" class="gtb-theme-btn" onclick="toggleTheme()" title="Alternar tema">${getTheme() === 'light' ? ICON_SUN : ICON_MOON}</button>
    <button id="globalSettingsBtn" class="gtb-theme-btn ${isOnConta ? 'gtb-active' : ''}" onclick="window.location.href='${contaHref}'" title="Minha conta">${ICON_GEAR}</button>
  `;
  document.body.appendChild(bar);

  loadNotifBell();

  // Atalho Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'Escape') closeGlobalSearch();
  });
}

// ── Busca global ──
function openGlobalSearch() {
  let overlay = document.getElementById('globalSearchOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'globalSearchOverlay';
    overlay.className = 'gsearch-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeGlobalSearch(); };
    overlay.innerHTML = `
      <div class="gsearch-box">
        <div class="gsearch-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="globalSearchInput" placeholder="Buscar páginas, pedido, WhatsApp, produto..." autocomplete="off"/>
          <kbd>ESC</kbd>
        </div>
        <div id="gsearchResults" class="gsearch-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('globalSearchInput').addEventListener('input', handleGlobalSearch);
  }
  overlay.classList.add('gsearch-show');
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
  renderGlobalSearchDefault();
}

function closeGlobalSearch() {
  const overlay = document.getElementById('globalSearchOverlay');
  if (overlay) overlay.classList.remove('gsearch-show');
}

const GLOBAL_PAGES = [
  { label: 'Novo cadastro', icon: '📝', href: 'index.html', hrefSub: '../index.html' },
  { label: 'Dashboard',     icon: '📊', href: 'pages/dashboard.html', hrefSub: 'dashboard.html' },
  { label: 'Registros',     icon: '📋', href: 'pages/registros.html', hrefSub: 'registros.html' },
  { label: 'Envios Influencers', icon: '📮', href: 'pages/envios-influencers.html', hrefSub: 'envios-influencers.html' },
  { label: 'Devoluções', icon: '↩️', href: 'pages/devolucoes.html', hrefSub: 'devolucoes.html' },
  { label: 'Notas',         icon: '📝', href: 'pages/notas.html', hrefSub: 'notas.html' },
  { label: 'Gerador de links', icon: '🔗', href: 'pages/links.html', hrefSub: 'links.html' },
  { label: 'Histórico',     icon: '🕓', href: 'pages/historico.html', hrefSub: 'historico.html' },
  { label: 'Produtos',      icon: '📦', href: 'pages/produtos.html', hrefSub: 'produtos.html' },
  { label: 'Tarefas',       icon: '✅', href: 'pages/tarefas.html', hrefSub: 'tarefas.html' },
  { label: 'Usuários',      icon: '👥', href: 'pages/usuarios.html', hrefSub: 'usuarios.html' },
  { label: 'Minha conta',   icon: '⚙️', href: 'pages/conta.html', hrefSub: 'conta.html' },
];

function isInSubPage() {
  return window.location.pathname.includes('/pages/');
}

function renderGlobalSearchDefault() {
  const results = document.getElementById('gsearchResults');
  if (!results) return;
  results.innerHTML = `
    <div class="gsearch-section-label">Páginas</div>
    ${GLOBAL_PAGES.map(p => `
      <a class="gsearch-item" href="${isInSubPage() ? p.hrefSub : p.href}">
        <span class="gsearch-item-icon">${p.icon}</span>
        <span>${p.label}</span>
      </a>
    `).join('')}
  `;
}

let searchDebounce;
function handleGlobalSearch(e) {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  if (!q) { renderGlobalSearchDefault(); return; }

  searchDebounce = setTimeout(async () => {
    const results = document.getElementById('gsearchResults');
    const qLower = q.toLowerCase();

    // Filtra páginas
    const pageMatches = GLOBAL_PAGES.filter(p => p.label.toLowerCase().includes(qLower));

    let html = '';
    if (pageMatches.length) {
      html += `<div class="gsearch-section-label">Páginas</div>`;
      html += pageMatches.map(p => `
        <a class="gsearch-item" href="${isInSubPage() ? p.hrefSub : p.href}">
          <span class="gsearch-item-icon">${p.icon}</span>
          <span>${p.label}</span>
        </a>
      `).join('');
    }

    // Busca em registros (se Supabase pronto)
    if (isSupabaseReady() && q.length >= 2) {
      try {
        const empresa = getEmpresaAtiva();
        const rows = await sbFetch(`registros?or=(numero_pedido.ilike.*${q}*,whatsapp.ilike.*${q}*,motivo.ilike.*${q}*)&empresa_id=eq.${empresa}&limit=5`);
        if (rows?.length) {
          html += `<div class="gsearch-section-label">Registros</div>`;
          html += rows.map(r => `
            <a class="gsearch-item" href="${isInSubPage() ? 'registros.html' : 'pages/registros.html'}">
              <span class="gsearch-item-icon">${r.tipo === 'Reenvio' ? '📦' : '❌'}</span>
              <span>${escapeHtml(r.numero_pedido)} — ${escapeHtml(r.motivo || '')}</span>
            </a>
          `).join('');
        }
      } catch {}
    }

    results.innerHTML = html || `<div class="gsearch-empty">Nenhum resultado para "${escapeHtml(q)}"</div>`;
  }, 250);
}

// Injeta a topbar quando a página carrega
document.addEventListener('DOMContentLoaded', injectGlobalTopbar);

// ── Painel de Notificações (sino) ──
let notifCache = [];

async function loadNotifBell() {
  if (!isSupabaseReady() || !isAuthenticated()) return;
  try {
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();
    const hoje    = new Date().toISOString().slice(0, 10);

    const notifs = [];

    // Tarefas pendentes
    try {
      const tarefas = await sbFetch(
        `tarefas?atribuido_para=eq.${user.id}&empresa_id=eq.${empresa}&status=eq.pendente&order=criado_em.desc&limit=20`
      );
      (tarefas || []).forEach(t => {
        const vencido  = t.prazo && t.prazo < hoje;
        notifs.push({
          tipo: 'tarefa',
          icon: vencido ? '⚠️' : '📋',
          titulo: t.titulo,
          sub: vencido ? 'Tarefa vencida' : 'Tarefa pendente',
          urgente: vencido,
          href: 'tarefas.html',
        });
      });
    } catch {}

    // Clientes pendentes (hoje ou atrasados)
    try {
      const clientes = await sbFetch(
        `clientes_pendentes?select=*&empresa_id=eq.${empresa}&data_combinada=lte.${hoje}`
      );
      (clientes || []).forEach(c => {
        const atrasado = c.data_combinada < hoje;
        notifs.push({
          tipo: 'cliente',
          icon: atrasado ? '⚠️' : '🔔',
          titulo: c.nome,
          sub: atrasado ? 'Cliente atrasado' : 'Chamar hoje',
          urgente: atrasado,
          href: 'clientes-pendentes.html',
        });
      });
    } catch {}

    // Solicitações pendentes (admin)
    if (isAdmin()) {
      try {
        const sols = await sbFetch(`profiles?ativo=eq.false&select=*`);
        (sols || []).forEach(s => {
          notifs.push({
            tipo: 'solicitacao',
            icon: '👤',
            titulo: s.nome,
            sub: 'Solicitação de acesso',
            urgente: false,
            href: 'usuarios.html',
          });
        });
      } catch {}
    }

    // Ordena: urgentes primeiro
    notifs.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
    notifCache = notifs;

    const badge = document.getElementById('globalBellBadge');
    if (badge) {
      const count = notifs.length;
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.toggle('hidden', count === 0);
    }
  } catch(e) { console.error('loadNotifBell error:', e); }
}

function toggleNotifPanel() {
  let panel = document.getElementById('notifPanel');
  if (panel) {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderNotifPanel();
    return;
  }

  const inSubPage = window.location.pathname.includes('/pages/');

  panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel hidden';
  panel.innerHTML = `
    <div class="notif-panel-header">
      <span>Notificações</span>
      <button class="notif-panel-close" onclick="toggleNotifPanel()">✕</button>
    </div>
    <div id="notifPanelList" class="notif-panel-list"></div>
  `;
  document.body.appendChild(panel);
  panel.classList.remove('hidden');
  panel.dataset.subpage = inSubPage ? '1' : '0';
  renderNotifPanel();
}

function renderNotifPanel() {
  const list = document.getElementById('notifPanelList');
  if (!list) return;

  if (!notifCache.length) {
    list.innerHTML = `<div class="notif-empty">🎉 Nenhuma notificação pendente!</div>`;
    return;
  }

  const panel = document.getElementById('notifPanel');
  const inSubPage = panel?.dataset.subpage === '1';

  list.innerHTML = notifCache.map(n => `
    <div class="notif-item ${n.urgente ? 'notif-urgente' : ''}" onclick="window.location.href='${inSubPage ? n.href : 'pages/' + n.href}'">
      <span class="notif-item-icon">${n.icon}</span>
      <div class="notif-item-body">
        <div class="notif-item-titulo">${escapeHtml(n.titulo)}</div>
        <div class="notif-item-sub">${escapeHtml(n.sub)}</div>
      </div>
    </div>
  `).join('');
}

// Fecha o painel ao clicar fora
document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const bell  = document.getElementById('globalBellBtn');
  if (!panel || panel.classList.contains('hidden')) return;
  if (!panel.contains(e.target) && !bell?.contains(e.target)) {
    panel.classList.add('hidden');
  }
});
