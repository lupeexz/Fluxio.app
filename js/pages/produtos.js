document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  showUserInfo();
  loadProdutos();
  document.getElementById('formProduto').addEventListener('submit', handleAdd);
  document.getElementById('modalForm').addEventListener('submit', handleEditSave);
  document.getElementById('filterSearch').addEventListener('input', () => renderTable());
  document.getElementById('filterCat').addEventListener('change', () => renderTable());
});

let allProdutos = [];
let editingId   = null;
let deletingId  = null;

// ── Carrega produtos ──
async function loadProdutos() {
  try {
    if (!isSupabaseReady()) throw new Error('Supabase não configurado.');
    const empresa = getEmpresaAtiva();
    allProdutos = await dbGetProdutosByEmpresa(empresa) || [];
    populateCatFilter();
    renderTable();
  } catch(e) {
    console.error(e);
    allProdutos = [];
    document.getElementById('prodBody').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:2rem">Erro ao carregar produtos do banco: ${escapeHtml(e.message)}. Tente atualizar a página.</td></tr>`;
  }
}

// ── Filtra ──
function getFiltered() {
  const q   = document.getElementById('filterSearch').value.toLowerCase().trim();
  const cat = document.getElementById('filterCat').value;
  return allProdutos.filter(p => {
    if (cat && p.categoria !== cat) return false;
    if (q && !p.nome.toLowerCase().includes(q) && !(p.link_yampi||'').toLowerCase().includes(q)) return false;
    return true;
  });
}

// ── Renderiza tabela ──
function renderTable() {
  const items = getFiltered();
  const chip  = document.getElementById('countChip');
  chip.innerHTML = `<span class="status-dot-green"></span>${allProdutos.length} produto${allProdutos.length !== 1 ? 's' : ''}`;

  const isAdm = isAdmin();
  const body  = document.getElementById('prodBody');

  if (!items.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = items.map(p => `
    <tr>
      <td style="font-weight:600">${escapeHtml(p.nome)}</td>
      <td><span class="pill">${escapeHtml(p.categoria)}</span></td>
      <td style="max-width:240px">
        <a href="${escapeHtml(p.link_yampi)}" target="_blank" style="color:var(--brand);font-size:11px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:220px">${escapeHtml(p.link_yampi)}</a>
      </td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:999px;font-weight:700;background:var(--brand-dim);color:#8ec5ff;border:1px solid var(--brand-border)">Banco</span></td>
      <td class="actions">
        <button class="mini secondary" onclick="copyText('${escapeAttr(p.link_yampi)}')">Copiar</button>
        ${isAdm && p.id ? `
          <button class="mini" onclick="abrirEdit('${p.id}','${escapeAttr(p.nome)}','${escapeAttr(p.link_yampi)}','${escapeAttr(p.categoria)}')" style="background:rgba(91,156,246,.15);color:#8ec5ff;border:1px solid rgba(91,156,246,.3)">Editar</button>
          <button class="mini" onclick="abrirDelete('${p.id}','${escapeAttr(p.nome)}')" style="background:rgba(241,106,126,.12);color:var(--danger);border:1px solid rgba(241,106,126,.3)">Remover</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

// ── Adicionar produto ──
async function handleAdd(e) {
  e.preventDefault();
  const nome      = document.getElementById('inputNome').value.trim();
  const link      = document.getElementById('inputLink').value.trim();
  const categoria = document.getElementById('inputCat').value;
  if (!nome || !link || !categoria) return;
  try {
    if (isSupabaseReady()) {
      const user = getSessionUser();
      const empresaId = getEmpresaAtiva();
      await dbCreateProduto({ nome, link_yampi: link, categoria, ativo: true, criado_por: user?.id || null, empresa: getEmpresaNome(), empresa_id: empresaId });
    }
    document.getElementById('formProduto').reset();
    showMsg(`"${nome}" adicionado com sucesso!`, 'ok');
    loadProdutos();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── Modal Editar ──
function abrirEdit(id, nome, link, cat) {
  editingId = id;
  document.getElementById('editNome').value = nome;
  document.getElementById('editLink').value = link;
  document.getElementById('editCat').value  = cat;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editingId = null;
}

async function handleEditSave(e) {
  e.preventDefault();
  if (!editingId) return;
  const nome      = document.getElementById('editNome').value.trim();
  const link      = document.getElementById('editLink').value.trim();
  const categoria = document.getElementById('editCat').value;
  try {
    await sbFetch(`produtos?id=eq.${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome, link_yampi: link, categoria }),
    });
    fecharModal();
    showMsg('Produto atualizado!', 'ok');
    loadProdutos();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── Modal Remover ──
function abrirDelete(id, nome) {
  deletingId = id;
  document.getElementById('deleteNome').textContent = nome;
  document.getElementById('deleteOverlay').classList.remove('hidden');
}

function fecharDelete() {
  document.getElementById('deleteOverlay').classList.add('hidden');
  deletingId = null;
}

async function confirmarDelete() {
  if (!deletingId) return;
  try {
    await dbDeleteProduto(deletingId);
    fecharDelete();
    showMsg('Produto removido.', 'ok');
    loadProdutos();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── Helpers ──
function populateCatFilter() {
  const cats = [...new Set(allProdutos.map(p => p.categoria))].filter(Boolean).sort();
  const sel  = document.getElementById('filterCat');
  const cur  = sel.value;
  sel.innerHTML = '<option value="">Todas</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className   = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}

function escapeAttr(val) {
  return String(val || '').replaceAll("'", "\\'").replaceAll('"', '&quot;');
}
