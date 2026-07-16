let allRecords = [];

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  showUserInfo();

  ["filterMode", "filterDate", "filterMonth", "filterType"].forEach((id) => {
    $(id).addEventListener("change", renderDashboard);
    $(id).addEventListener("input", renderDashboard);
  });

  $("filterMode").addEventListener("change", () => {
    $("filterDateWrap").classList.toggle("hidden", $("filterMode").value !== "day");
    $("filterMonthWrap").classList.toggle("hidden", $("filterMode").value !== "month");
  });

  const refreshBtn = $("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => { loadDashboard(true); loadImpactoMetrics(); });

  loadDashboard(false);
  loadImpactoMetrics();
});

// ── Métricas de impacto ──
async function loadImpactoMetrics() {
  const empresa = getEmpresaAtiva();

  // Valor recuperado em devoluções reintegradas ao estoque
  try {
    const devolucoes = await dbGetDevolucoes(empresa) || [];
    const recuperado = devolucoes
      .filter(d => d.status === 'reintegrado_estoque')
      .reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
    $("statValorRecuperado").textContent = formatBRL(recuperado);
  } catch(e) { console.error(e); }

  // Tempo médio de resolução de tarefas (criação → conclusão)
  try {
    const tarefas = await sbFetch(
      `tarefas?select=criado_em,atualizado_em,status&empresa_id=eq.${empresa}&status=in.(concluida,arquivada)`
    ) || [];
    const tempos = tarefas
      .filter(t => t.criado_em && t.atualizado_em)
      .map(t => new Date(t.atualizado_em) - new Date(t.criado_em))
      .filter(ms => ms > 0);

    if (tempos.length) {
      const mediaMs = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      $("statTempoResolucao").textContent = formatDuracao(mediaMs);
    } else {
      $("statTempoResolucao").textContent = '—';
    }
  } catch(e) { console.error(e); }
}

function formatDuracao(ms) {
  const horas = ms / (1000 * 60 * 60);
  if (horas < 1) return Math.round(ms / (1000 * 60)) + ' min';
  if (horas < 24) return horas.toFixed(1).replace('.0', '') + 'h';
  const dias = horas / 24;
  return dias.toFixed(1).replace('.0', '') + ' dia' + (dias >= 2 ? 's' : '');
}

async function loadDashboard(force = false) {
  try {
    setDashboardLoading(force ? "Atualizando..." : "Carregando...");

    // Mostra cache imediatamente.
    if (!force) {
      allRecords = await apiGetRecords({ background: true });
      renderDashboard();
    }

    // Atualização real quando forçado ou se não havia cache.
    if (force || !allRecords.length) {
      allRecords = await apiRefreshRecords();
      renderDashboard();
    }
  } catch (error) {
    console.error(error);
  } finally {
    setDashboardLoading("");
  }
}

function setDashboardLoading(text) {
  const btn = $("refreshBtn");
  if (!btn) return;
  btn.disabled = Boolean(text);
  btn.textContent = text || "Atualizar";
}

function filteredRecords() {
  const mode = $("filterMode").value;
  const type = $("filterType").value;
  const day = $("filterDate").value;
  const month = $("filterMonth").value;

  return allRecords.filter((r) => {
    if (type !== "all" && r.tipo !== type) return false;

    const d = r.dataPedido || "";
    if (mode === "day" && day && d !== day) return false;
    if (mode === "month" && month && !d.startsWith(month)) return false;

    return true;
  });
}

function renderDashboard() {
  const records = filteredRecords();

  const cancelamentos = records.filter((r) => r.tipo === "Cancelamento").length;
  const reenvios = records.filter((r) => r.tipo === "Reenvio").length;
  const totalValor = records.reduce((sum, r) => sum + parseBRL(r.fretesEstorno), 0);

  $("statCancelamento").textContent = cancelamentos;
  $("statReenvio").textContent = reenvios;
  $("statValor").textContent = formatBRL(totalValor);

  drawBarChart("chartTipo", [
    ["Cancelamento", cancelamentos],
    ["Reenvio", reenvios],
  ]);

  drawBarChart("chartLojas", topCounts(records, "loja", 5));
  drawBarChart("chartMotivos", topCounts(records, "motivo", 5));
}

function topCounts(records, key, limit) {
  const map = new Map();

  records.forEach((r) => {
    const k = String(r[key] || "Não informado").trim() || "Não informado";
    map.set(k, (map.get(k) || 0) + 1);
  });

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function drawBarChart(canvasId, items) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const cssWidth = Math.max(rect.width, 300);
  const cssHeight = 190;

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  canvas.style.height = `${cssHeight}px`;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.font = "12px Inter, system-ui";
  ctx.fillStyle = "#8ea0bf";

  if (!items.length || items.every((i) => !i[1])) {
    ctx.fillText("Sem dados para o filtro.", 18, cssHeight / 2);
    return;
  }

  const max = Math.max(...items.map((i) => Number(i[1]) || 0), 1);
  const labelW = Math.min(135, Math.max(96, cssWidth * 0.25));
  const x = labelW + 22;
  const top = 20;
  const gap = 10;
  const barHeight = 20;
  const chartW = cssWidth - x - 34;

  items.forEach(([label, value], index) => {
    const y = top + index * (barHeight + gap);
    if (y + barHeight > cssHeight - 10) return;

    const safeValue = Number(value) || 0;
    const barWidth = Math.max((safeValue / max) * chartW, safeValue ? 8 : 0);
    const text = String(label || "").length > 15 ? String(label).slice(0, 15) + "..." : String(label || "");

    ctx.fillStyle = "#aebbd1";
    ctx.fillText(text, 16, y + 15);

    const gradient = ctx.createLinearGradient(x, y, x + barWidth, y);
    gradient.addColorStop(0, "#2563eb");
    gradient.addColorStop(1, "#22d3ee");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#e8eefc";
    ctx.fillText(String(safeValue), x + barWidth + 8, y + 15);
  });
}
