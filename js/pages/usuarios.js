document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  if (!isAdmin()) { alert('Acesso restrito a administradores.'); window.location.href = '../index.html'; return; }
  showUserInfo();
  mostrarCodigoEmpresa();
  loadUsuarios();
  document.getElementById('modalForm').addEventListener('submit', handleEditSave);
});

function mostrarCodigoEmpresa() {
  const user = getSessionUser();
  const el = document.getElementById('codigoEmpresa');
  if (el) el.textContent = user?.empresa_slug || '—';
}

// ── USUÁRIOS + SOLICITAÇÕES (tudo é a mesma tabela: profiles) ──
async function loadUsuarios() {
  try {
    if (!isSupabaseReady()) {
      showMsg('Supabase não configurado no config.js', 'error');
      return;
    }
    const all = await dbGetUsuarios() || [];
    renderSolicitacoes(all.filter(u => !u.ativo));
    renderUsuarios(all.filter(u => u.ativo));
  } catch(e) {
    console.error('loadUsuarios error:', e);
    showMsg('Erro ao carregar: ' + e.message, 'error');
  }
}

// ── PENDENTES (perfis com ativo=false — pediram pra entrar na empresa) ──
function renderSolicitacoes(pend) {
  const sec  = document.getElementById('solicitacoesSection');
  const chip = document.getElementById('pendChip');
  if (!pend.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  chip.textContent  = pend.length + ' pendente' + (pend.length > 1 ? 's' : '');
  document.getElementById('solicitacoesBody').innerHTML = pend.map(s => `
    <tr>
      <td style="font-weight:600">${escapeHtml(s.nome)}</td>
      <td style="color:var(--muted)">${escapeHtml(s.email || '—')}</td>
      <td style="font-size:12px;color:var(--muted)">${formatDateTime(s.criado_em)}</td>
      <td class="actions">
        <button class="mini" onclick="aprovar('${s.id}')" style="background:var(--ok)">✓ Aprovar</button>
        <button class="mini secondary" onclick="recusar('${s.id}')" style="color:var(--danger);border-color:rgba(241,106,126,.3)">✕ Recusar</button>
      </td>
    </tr>
  `).join('');
}

async function aprovar(id) {
  try {
    await dbUpdateUsuario(id, { ativo: true });
    showMsg('Acesso aprovado!', 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function recusar(id) {
  if (!confirm('Recusar essa solicitação? A pessoa perde o acesso ao Fluxio (a conta de login dela continua existindo, só não fica ligada a nenhuma empresa).')) return;
  try {
    await dbDeleteUsuario(id);
    showMsg('Solicitação recusada.', 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── USUÁRIOS ATIVOS ──
function renderUsuarios(users) {
  const chip = document.getElementById('countChip');
  chip.innerHTML = `<span class="status-dot-green"></span>${users.length} usuário${users.length !== 1 ? 's' : ''}`;

  const me = getSessionUser();
  document.getElementById('usersBody').innerHTML = users.length
    ? users.map(u => `
      <tr>
        <td style="font-weight:600">${escapeHtml(u.nome)}</td>
        <td style="color:var(--muted);font-size:12px">${escapeHtml(u.email || '—')}</td>
        <td>
          <span class="pill" style="${u.role === 'admin' ? '' : 'background:rgba(124,106,245,.12);color:#b8aff8;border-color:rgba(124,106,245,.25)'}">
            ${u.role === 'admin' ? 'Admin' : 'Atendente'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--muted)">${formatDateTime(u.criado_em)}</td>
        <td class="actions">
          <button class="mini" onclick="abrirModal('${u.id}','${escapeAttr(u.nome)}','${u.role}')" style="background:rgba(91,156,246,.15);color:#8ec5ff;border:1px solid rgba(91,156,246,.3)">✏️ Editar</button>
          ${u.id !== me?.id ? `
            <button class="mini" onclick="toggleAtivo('${u.id}')" style="background:rgba(240,160,48,.1);color:var(--warning);border:1px solid rgba(240,160,48,.3)">Desativar</button>
            <button class="mini" onclick="abrirDeleteUser('${u.id}','${escapeAttr(u.nome)}','${escapeAttr(u.email||'')}')" style="background:rgba(241,106,126,.12);color:var(--danger);border:1px solid rgba(241,106,126,.3)">🗑️ Remover</button>
          ` : '<span style="font-size:11px;color:var(--muted)">(você)</span>'}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">Nenhum usuário ativo ainda.</td></tr>`;
}

// ── MODAL EDITAR (nome e cargo — senha só o próprio usuário troca, na Conta) ──
let editingId      = null;
let deletingUserId = null;

function abrirModal(id, nome, role) {
  editingId = id;
  document.getElementById('editNome').value = nome;
  document.getElementById('editRole').value = role;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editingId = null;
}

async function handleEditSave(e) {
  e.preventDefault();
  if (!editingId) return;
  const data = {
    nome: document.getElementById('editNome').value.trim(),
    role: document.getElementById('editRole').value,
  };
  try {
    await dbUpdateUsuario(editingId, data);
    fecharModal();
    showMsg('Usuário atualizado!', 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── REMOVER USUÁRIO ──
function abrirDeleteUser(id, nome, email) {
  deletingUserId = id;
  document.getElementById('deleteUserNome').textContent  = nome;
  document.getElementById('deleteUserEmail').textContent = email;
  document.getElementById('deleteUserOverlay').classList.remove('hidden');
}

function fecharDeleteUser() {
  document.getElementById('deleteUserOverlay').classList.add('hidden');
  deletingUserId = null;
}

async function confirmarDeleteUser() {
  if (!deletingUserId) return;
  try {
    await dbDeleteUsuario(deletingUserId);
    fecharDeleteUser();
    showMsg('Usuário removido.', 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function toggleAtivo(id) {
  if (!confirm('Desativar esse usuário? Ele perde o acesso até você reativar.')) return;
  try { await dbUpdateUsuario(id, { ativo: false }); loadUsuarios(); }
  catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 4000);
}

function escapeAttr(val) { return String(val||'').replaceAll("'","\\'").replaceAll('"','&quot;'); }
