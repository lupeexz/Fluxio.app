let allRecords = [];

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  showUserInfo();

  ["search", "type", "dateStart", "dateEnd"].forEach((id) => {
    $(id).addEventListener("input", renderRecords);
    $(id).addEventListener("change", renderRecords);
  });

  const refreshBtn = $("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadRecords(true));

  loadRecords(false);
});

async function loadRecords(force = false) {
  try {
    setRecordsLoading(force ? "Atualizando..." : "Carregando...");

    if (!force) {
      allRecords = await apiGetRecords({ background: true });
      allRecords = filterByEmpresa(allRecords);
      renderRecords();
    }

    if (force || !allRecords.length) {
      allRecords = await apiRefreshRecords();
      allRecords = filterByEmpresa(allRecords);
      renderRecords();
    }
  } catch (error) {
    console.error(error);
    renderRecordsError(error.message || "Erro ao carregar registros.");
  } finally {
    setRecordsLoading("");
  }
}

function filterByEmpresa(records) {
  const empresa = getEmpresaAtiva();
  // Todos filtram pela empresa ativa — admin troca pelo dropdown
  return records.filter(r => !r.empresa || r.empresa === empresa || r.loja === empresa);
}

function setRecordsLoading(text) {
  const btn = $("refreshBtn");
  if (!btn) return;
  btn.disabled = Boolean(text);
  btn.textContent = text || "Atualizar";
}

function getFiltered() {
  const q = $("search").value.toLowerCase().trim();
  const type = $("type").value;
  const start = $("dateStart").value;
  const end = $("dateEnd").value;

  return allRecords.filter((r) => {
    if (type !== "all" && r.tipo !== type) return false;

    const d = r.dataPedido || "";
    if (start && d < start) return false;
    if (end && d > end) return false;

    if (q) {
      const haystack = [
        r.tipo,
        r.loja,
        r.dataPedido,
        r.motivo,
        r.fretesEstorno,
        r.numeroPedido,
        r.whatsapp,
        r.novoCodigoRastreio,
        r.dataReenvio,
      ].join(" ").toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

function renderRecords() {
  const records = getFiltered()
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

  const isAdm = isAdmin();

  $("recordsBody").innerHTML = records.map((r) => `
    <tr>
      <td><span class="pill">${escapeHtml(r.tipo)}</span></td>
      <td>${escapeHtml(r.loja)}</td>
      <td>${formatDate(r.dataPedido)}</td>
      <td>${escapeHtml(r.motivo)}</td>
      <td>${formatBRL(parseBRL(r.fretesEstorno))}</td>
      <td>${escapeHtml(r.numeroPedido)}</td>
      <td>${escapeHtml(r.whatsapp)}</td>
      <td>${escapeHtml(r.novoCodigoRastreio)}</td>
      <td>${formatDate(r.dataReenvio)}</td>
      <td>${escapeHtml(r.usuarioNome || '—')}</td>
      <td>${formatDateTime(r.criadoEm)}</td>
      <td class="actions">
        <button class="mini secondary" type="button" onclick="copyText('${escapeAttr(r.whatsapp)}')">Copiar Whats</button>
        <button class="mini" type="button" onclick="openWhatsapp('${escapeAttr(r.whatsapp)}')">Abrir</button>
        ${r.id ? `
          <button class="mini" type="button" onclick='abrirEditRegistro(${JSON.stringify(r).replace(/'/g, "&#39;")})' style="background:rgba(91,156,246,.15);color:#8ec5ff;border:1px solid rgba(91,156,246,.3)">Editar</button>
          ${isAdm ? `<button class="mini" type="button" onclick="abrirDeleteRegistro('${r.id}','${escapeAttr(r.numeroPedido)}')" style="background:rgba(241,106,126,.12);color:var(--danger);border:1px solid rgba(241,106,126,.3)">Remover</button>` : ''}
        ` : ''}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="12">Nenhum registro encontrado.</td></tr>`;
}

function renderRecordsError(message) {
  $("recordsBody").innerHTML = `<tr><td colspan="11">${escapeHtml(message)}</td></tr>`;
}

function exportCsv() {
  const records = getFiltered();
  const headers = [
    "Tipo",
    "Loja",
    "Data Pedido",
    "Motivo",
    "Valor",
    "Pedido",
    "WhatsApp",
    "Rastreio",
    "Data Reenvio",
    "Criado em",
  ];

  const rows = records.map((r) => [
    r.tipo,
    r.loja,
    r.dataPedido,
    r.motivo,
    formatBRL(parseBRL(r.fretesEstorno)),
    r.numeroPedido,
    r.whatsapp,
    r.novoCodigoRastreio,
    r.dataReenvio,
    r.criadoEm,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function escapeAttr(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

// ── EDITAR REGISTRO ──
let editingRecordId = null;
let deletingRecordId = null;

function abrirEditRegistro(r) {
  editingRecordId = r.id;
  document.getElementById('editTipo').value          = r.tipo || '';
  document.getElementById('editMotivo').value        = r.motivo || '';
  document.getElementById('editFretes').value        = r.fretesEstorno || '';
  document.getElementById('editPedido').value        = r.numeroPedido || '';
  document.getElementById('editWhatsapp').value      = r.whatsapp || '';
  document.getElementById('editRastreio').value      = r.novoCodigoRastreio || '';
  document.getElementById('editDataPedido').value    = (r.dataPedido || '').slice(0, 10);
  document.getElementById('editDataReenvio').value   = (r.dataReenvio || '').slice(0, 10);
  document.getElementById('editRegistroOverlay').classList.remove('hidden');
}

function fecharEditRegistro() {
  document.getElementById('editRegistroOverlay').classList.add('hidden');
  editingRecordId = null;
}

async function salvarEditRegistro(e) {
  e.preventDefault();
  if (!editingRecordId) return;

  const data = {
    tipo:                 document.getElementById('editTipo').value,
    motivo:               document.getElementById('editMotivo').value.trim(),
    fretes_estorno:       document.getElementById('editFretes').value.trim(),
    numero_pedido:        document.getElementById('editPedido').value.trim(),
    whatsapp:             document.getElementById('editWhatsapp').value.trim(),
    novo_codigo_rastreio: document.getElementById('editRastreio').value.trim(),
    data_pedido:          document.getElementById('editDataPedido').value || null,
    data_reenvio:         document.getElementById('editDataReenvio').value || null,
  };

  try {
    await dbUpdateRegistro(editingRecordId, data);
    fecharEditRegistro();
    clearRecordsCache();
    await loadRecords(true);
  } catch(e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

// ── REMOVER REGISTRO ──
function abrirDeleteRegistro(id, pedido) {
  deletingRecordId = id;
  document.getElementById('deleteRegistroPedido').textContent = pedido;
  document.getElementById('deleteRegistroOverlay').classList.remove('hidden');
}

function fecharDeleteRegistro() {
  document.getElementById('deleteRegistroOverlay').classList.add('hidden');
  deletingRecordId = null;
}

async function confirmarDeleteRegistro() {
  if (!deletingRecordId) return;
  try {
    await dbDeleteRegistro(deletingRecordId);
    fecharDeleteRegistro();
    clearRecordsCache();
    await loadRecords(true);
  } catch(e) {
    alert('Erro ao remover: ' + e.message);
  }
}
